---
layout: post
title: "Kotlin/Wasm: Tail Modulo Cons Lowering"
date: 2026-07-02
categories: [Technology, Compiler]
tags: [Kotlin, WebAssembly, Compiler, GSoC]
---

## Overview

[Tail Modulo Cons](https://arxiv.org/abs/2102.09823) (Bour, Clément, Scherer) rewrites recursion whose result feeds a constructor into destination-passing style, turning the recursive call into a true tail call. OCaml 4.14 shipped this as [`[@tail_mod_cons]`](https://ocaml.org/manual/5.1/tail_mod_cons.html). [PR 14](https://github.com/ternbusty/kotlin/pull/14) brings the same transformation to Kotlin/Wasm as `@kotlin.wasm.TailModCons`.

## What TMC does

```kotlin
class Cell(val value: Int, var next: Cell?)

@TailModCons
fun chain(n: Int): Cell? {
    if (n == 0) return null
    return Cell(n, chain(n - 1))
}
```

`chain(n - 1)` is not in tail position because its result is wrapped in the `Cell` constructor, so `-Xwasm-enable-tail-calls` alone cannot help. On V8, this overflows around depth 10,000.

`@TailModCons` rewrites this into destination-passing style (DPS). Instead of returning a constructor that wraps the recursive result, the caller allocates the constructor first with a null placeholder in the recursive field, then passes the allocated object as a "destination" to the recursive call. The recursive call fills the placeholder via `struct.set` and tail-calls itself with the next destination. The compiler splits the function into a wrapper and a `$tmcDps` helper.

![DPS transformation: each step allocates a cell with a null placeholder, fills the previous cell's next field via struct.set, and advances the destination pointer](/assets/img/2026-07-02-tmc-dps.svg)

```kotlin
// generated wrapper
fun chain(n: Int): Cell? {
    if (n == 0) return null
    val head = Cell(n, null)          // allocate with placeholder
    chain$tmcDps(n - 1, head)         // pass the placeholder's owner
    return head
}

// generated DPS helper
private fun chain$tmcDps(n: Int, dst: Cell) {
    if (n == 0) return                // base case: placeholder stays null
    val cell = Cell(n, null)          // next cell, again with placeholder
    dst.next = cell                   // fill previous placeholder (struct.set)
    return chain$tmcDps(n - 1, cell)  // tail call (return_call)
}
```

The self-call in `chain$tmcDps` is in tail position, so the compiler emits `return_call`. This emission is unconditional, independent of `-Xwasm-enable-tail-calls`, because the DPS helper cannot guarantee constant stack without it.

The detection looks for `return Constructor(args, f(args))` in the IR. When the TMC site is inside a `when` or `if` expression, the return wraps the entire `when`, not the constructor. The compiler normalizes `return when { ... }` into per-branch returns first so that each branch is visible as an `IrReturn`.

```kotlin
@TailModCons
fun buildList(n: Int): WhenCell? = when {
    n <= 0 -> null
    else -> WhenCell(n, buildList(n - 1))  // detected after normalization
}
```

The transform handles mutual recursion. When multiple `@TailModCons` functions form a cycle where each member wraps a call to another member in a constructor, the compiler generates a DPS helper for each function. Each helper tail-calls the callee's helper, forming a cycle of `return_call` instructions that runs in constant stack.

```kotlin
sealed interface IList
class ConsA(val head: Int, val tail: IList?) : IList
class ConsB(val head: Int, val tail: IList?) : IList

@TailModCons
fun mutualA(n: Int): IList? {
    if (n == 0) return null
    return ConsA(n, mutualB(n - 1))  // wraps mutualB's result in ConsA
}

@TailModCons
fun mutualB(n: Int): IList? {
    if (n == 0) return null
    return ConsB(n, mutualA(n - 1))  // wraps mutualA's result in ConsB
}
```

The compiler groups annotated functions into strongly connected components of the call graph. Each SCC forms one DPS cycle. The cycle size is not restricted. The same code path handles a 2-function cycle A&#8594;B&#8594;A and a 5-function cycle A&#8594;B&#8594;C&#8594;D&#8594;E&#8594;A.

## Performance

The benchmark measures the DPS transform on a linked-list construction.

```kotlin
@TailModCons
private fun chainTmcImpl(n: Int): Cell? {
    if (n == 0) return null
    return Cell(n, chainTmcImpl(n - 1))
}

private fun chainPlainImpl(n: Int): Cell? {
    if (n == 0) return null
    return Cell(n, chainPlainImpl(n - 1))
}
```

[Full benchmark source](https://github.com/ternbusty/wasm-tail-call-bench/blob/main/src/wasmJsMain/kotlin/bench/TmcPassBench.kt)

| depth | plain recursion (ops/s) | TMC (ops/s) | TMC / plain |
|---|---:|---:|---|
| 100 | 11,034,353 | 24,763,935 | 2.24x |
| 1,000 | 492,045 | 2,491,851 | 5.06x |
| 10,000 | 48,051 | 244,322 | 5.08x |
| 1,000,000 | stack overflow | 2,448 | - |

![TMC vs Plain Recursion](/assets/img/2026-07-02-tmc-chart.svg)

TMC is 2 to 5 times faster than plain recursion at every depth, including the shallowest. The `return_call` self-loop eliminates frame allocation and teardown, which outweighs the cost of the null-placeholder allocation and `struct.set` fill.

Environment for reproduction. Apple M1 Pro, Node 26.2.0, kotlinx-benchmark with 5 warmup and 10 measurement iterations of 1 second each.

## Applicability

TMC rewrites recursion whose result feeds a constructor. In OCaml, building a list by consing is the default.

```ocaml
let rec map f = function
  | [] -> []
  | x :: xs -> f x :: map f xs   (* tail modulo cons *)
```

Kotlin developers build the same structures with mutable collections. For example, Apollo's GraphQL parser [`Parser.kt`](https://github.com/apollographql/apollo-kotlin/blob/main/libraries/apollo-ast/src/commonMain/kotlin/com/apollographql/apollo/ast/internal/Parser.kt#L925) builds its AST nodes with `buildList`. The shape that TMC targets does not appear in this style.

```kotlin
private fun parseDirectives(const: Boolean): List<GQLDirective> {
    return buildList {
        while (token is Token.At) {
            add(parseDirective(const))
        }
    }
}
```

The shape partially appears in mutual recursion. In square/wire's protobuf option parser, [`readKindAndValue`](https://github.com/square/wire/blob/master/wire-schema/src/commonMain/kotlin/com/squareup/wire/schema/internal/parser/OptionReader.kt#L96) wraps the results of `readMap` and `readList` in a `KindAndValue` constructor.

```kotlin
private fun readKindAndValue(): KindAndValue {
  when (val peeked = reader.peekChar()) {
    '{' -> return KindAndValue(MAP, readMap('{', '}', ':'))  // TMC shape
    '[' -> return KindAndValue(LIST, readList())              // TMC shape
    // ...
  }
}
```

However, extending TMC to mutual recursion cycles requires every edge in the cycle to be in tail or TMC position. The backward edge from `readList` back to `readKindAndValue` accumulates results inside a `while(true)` loop, making it non-tail.

```kotlin
private fun readList(): List<Any> {
  val result = mutableListOf<Any>()
  while (true) {
    val option = readKindAndValue()  // non-tail: result is accumulated and not returned
    result.add(option.value)
    // ...
  }
  return result
}
```

The same structure appears in every parser cycle found in the survey. A single non-tail edge in the cycle is enough to prevent the transformation, since frames accumulate at that edge regardless of what the other edges do.
