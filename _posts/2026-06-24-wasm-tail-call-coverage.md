---
layout: post
title: "Kotlin/Wasm Tail Calls: What We Can and Can't Optimize Today"
date: 2026-06-24
categories: [Technology, Compiler]
tags: [Kotlin, WebAssembly, Compiler, GSoC]
---

## Patterns that are optimized

### Static dispatch

[PR #2](https://github.com/ternbusty/kotlin/pull/2) makes any direct function call in tail position emit `return_call` instead of `call`.

```kotlin
fun isEven(n: Int): Boolean {
    if (n == 0) return true
    return isOdd(n - 1)   // emits return_call to isOdd
}

fun isOdd(n: Int): Boolean {
    if (n == 0) return false
    return isEven(n - 1)  // emits return_call to isEven
}
```

`tailrec` rewrites direct self-recursion into a loop. Mutual recursion between `isEven` and `isOdd` overflows at depth ~10K on V8 without tail calls but runs to 1M in constant stack with them.

The implementation also covers self-recursion without the `tailrec` annotation.

```kotlin
fun sumTo(n: Int, acc: Int = 0): Int {
    if (n == 0) return acc
    return sumTo(n - 1, acc + n)  // emits return_call (self)
}
```

[`TailrecLowering`](https://github.com/JetBrains/kotlin/blob/master/compiler/ir/backend.common/src/org/jetbrains/kotlin/backend/common/lower/TailrecLowering.kt) rewrites `tailrec fun sumTo(...)` into a `do-while` loop, which is ~20% faster. The compiler leaves `tailrec` functions alone and only emits native tail calls for unmarked ones.

### Virtual dispatch

[PR #3](https://github.com/ternbusty/kotlin/pull/3) extends tail call emission to virtual and interface dispatch. Calling an `open` or `abstract` method in tail position emits `return_call_ref` via the vtable.

```kotlin
sealed class Expr {
    abstract fun eval(env: Env): Value
}

class If(val cond: Expr, val then: Expr, val else_: Expr) : Expr() {
    override fun eval(env: Env): Value {
        return if (cond.eval(env).toBool())
            then.eval(env)   // return_call_ref via vtable
        else
            else_.eval(env)  // return_call_ref via vtable
    }
}
```

A chain of 10K `if` expressions overflows without tail calls but stays flat with them, because whichever branch `If.eval` picks is a tail call.

### Interface dispatch

Interface method calls in tail position emit `return_call_ref` via the itable.

```kotlin
interface Processor {
    fun process(data: Data): Result
}

class Pipeline(val stages: List<Processor>) {
    fun run(data: Data, index: Int = 0): Result {
        if (index == stages.lastIndex) return stages[index].process(data)
        val intermediate = stages[index].process(data)
        return run(intermediate.toData(), index + 1)  // return_call (self, static)
    }
}

class ValidateProcessor(val next: Processor) : Processor {
    override fun process(data: Data): Result {
        validate(data)
        return next.process(data)  // return_call_ref via itable
    }
}
```

### Function references

Calling a value of function type is an indirect call, even when it reads like a plain call.

```kotlin
fun doubled(x: Int) = x * 2

fun applyTransform(value: Int, transform: (Int) -> Int): Int {
    return transform(value)  // indirect: transform is a runtime value
}

fun main() {
    println(applyTransform(21, ::doubled))  // 42
}
```

For function references like `::doubled`, the compiler generates a reference class whose `invoke` bridge dispatches through `callRef`, a typed `call_ref` on a funcref. [PR #5](https://github.com/ternbusty/kotlin/pull/19) emits `return_call_ref` for that bridge in tail position.

## Lambda dispatch

Lambda closures go through `FunctionN<R>.invoke()`, which does not emit `return_call` today. Two Kotlin/Wasm-specific issues block it.

- [`GenericReturnTypeLowering`](https://github.com/JetBrains/kotlin/blob/master/compiler/ir/backend.wasm/src/org/jetbrains/kotlin/backend/wasm/lower/GenericReturnTypeLowering.kt) sees a mismatch between the erased return type `Any?` and the call-site type, wrapping the invoke in a cast that demotes it from tail position.

```
Composite {
    action.invoke()        // evaluated as a statement, discarded
    Unit.getInstance()     // the actual "result"
}
```

- Even without the cast, the Wasm-level signature mismatch between `anyref` and the caller's actual return type would cause the validator to reject `return_call_ref`.

```kotlin
fun runThen(n: Int, action: () -> Unit) {
    if (n == 0) return action()      // in tail position, but NOT emitted as a tail call
    return runThen(n - 1, action)    // emitted (static self-dispatch)
}
```

[PR #17](https://github.com/ternbusty/kotlin/pull/17) addresses both issues.

## Beyond tail position

The patterns above all require the call to be in tail position. Many recursive calls are not in tail positions.

```kotlin
return Cons(head, self(tail))       // constructor wrap
return 1 + self(n - 1)              // arithmetic
return process(self(subproblem))    // arbitrary computation
```

["Tail Recursion Modulo Context"](https://doi.org/10.1145/3571233) (Leijen and Lorenzen's, POPL 2023) provides a framework for these cases. The PR series implements three of these instantiations.

### Constructor contexts

When a constructor wraps the recursive result, the compiler allocates it with a null placeholder, tail-calls the recursion and patches the result in afterward. This is destination-passing style, the same transform [OCaml 4.14 shipped as `[@tail_mod_cons]`](https://ocaml.org/manual/5.1/tail_mod_cons.html).

```kotlin
fun replicate(n: Int, x: Int): IList<Int> = when {
    n <= 0 -> IList.Nil
    else -> IList.Cons(x, replicate(n - 1, x))  // context: Cons(x, ·)
}
```

See: [Kotlin/Wasm: Tail Modulo Cons Lowering](https://ternbusty.github.io/posts/wasm-tmc-selective-tail-calls.html)

### Monoid contexts

When an associative operation wraps the recursive result, the compiler passes an accumulator parameter.

```kotlin
fun countUp(n: Int): Int {
    if (n == 0) return 0
    return 1 + countUp(n - 1)  // context: 1 + ·
}

// Generated by the accumulator lowering
private fun countUp$accum(n: Int, acc: Int): Int {
    if (n == 0) return 0 + acc
    return countUp$accum(n - 1, 1 + acc)  // self-call in tail position
}
fun countUp(n: Int): Int = countUp$accum(n, 0)
```

Currently, [my PR](https://github.com/ternbusty/kotlin/pull/16) handles commutative operators on `Int` and `Long` with `+`, `*`, `and`, `or`, and `xor`. It also handles `String.plus`, which is associative but not commutative, by preserving operand order for one-sided patterns like `return str + self(args)`.

My PR does not cover the full general monoid case, where operands appear on both sides of the recursive call.

### CPS (Continuation-Passing Style)

Continuation-Passing Style is the most general instantiation. It can transform any recursive pattern by representing the context as a continuation function.

```kotlin
fun transform(n: Int): Int {
    if (n == 0) return 1
    return transform(n - 1) * 2 + 1  // context: · * 2 + 1
}

// CPS-transformed
fun transform_cps(n: Int, k: (Int) -> Int): Int {
    if (n == 0) return k(1)
    return transform_cps(n - 1) { x -> k(x * 2 + 1) }  // tail call
}
fun transform(n: Int): Int = transform_cps(n) { it }
```

This transformation is being implemented in [this PR](https://github.com/ternbusty/kotlin/pull/20) (work in progress).

Each recursive call allocates one closure, which can make performance worse. Constructor and accumulator transforms avoid this cost for their respective shapes, so the compiler prefers them over CPS when the pattern fits.

Kotlin's [`DeepRecursiveFunction`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-deep-recursive-function/) covers the same class of patterns at the library level through the coroutine machinery. The suspend/resume protocol per call can make it slower than native recursion on Kotlin/Wasm. Using it also requires rewriting the recursive function into the `DeepRecursiveFunction { ... }` form and replacing every recursive call with `callRecursive`.

```kotlin
// Before: plain recursion
fun sumList(node: ListNode?): Int {
    if (node == null) return 0
    return node.value + sumList(node.next)
}

// After: DeepRecursiveFunction rewrite
val sumList = DeepRecursiveFunction<ListNode?, Int> { node ->
    if (node == null) 0
    else node.value + callRecursive(node.next)
}
```

The CPS lowering automates this rewrite at the compiler level. The developer writes plain recursion and the compiler generates the heap-frame version.

### Others

The paper also describes following two patterns, but they are not implemented yet. These are covered by CPS.

- exponent contexts: the context is repeated application of the same function
- semiring contexts: combine two monoid operators with a distributivity law, such as `return x + 31 * hash(xs)`

## Real World Source Code Survey

I surveyed 18 Kotlin multiplatform libraries targeting wasmJs, selected from ~180 GitHub hits for `wasmJs() filename:build.gradle.kts` by domain likelihood of recursive logic. I classified every recursive call by which compiler transform could optimize it and verified each hit by hand.

<details>
<summary>Surveyed repositories</summary>

<ul>
<li><a href="https://github.com/arkivanov/Decompose">arkivanov/Decompose</a></li>
<li><a href="https://github.com/arrow-kt/arrow">arrow-kt/arrow</a></li>
<li><a href="https://github.com/a-sit-plus/jsonpath4k">a-sit-plus/jsonpath4k</a></li>
<li><a href="https://github.com/AdrianKuta/Tree-Data-Structure">AdrianKuta/Tree-Data-Structure</a></li>
<li><a href="https://github.com/Ashampoo/kim">Ashampoo/kim</a></li>
<li><a href="https://github.com/BenWoodworth/knbt">BenWoodworth/knbt</a></li>
<li><a href="https://github.com/boswelja/compose-markdown">boswelja/compose-markdown</a></li>
<li><a href="https://github.com/ExoQuery/pprint-kotlin">ExoQuery/pprint-kotlin</a></li>
<li><a href="https://github.com/huarangmeng/latex">huarangmeng/latex</a></li>
<li><a href="https://github.com/MohamedRejeb/compose-rich-editor">MohamedRejeb/compose-rich-editor</a></li>
<li><a href="https://github.com/MohamedRejeb/Ksoup">MohamedRejeb/Ksoup</a></li>
<li><a href="https://github.com/nacular/doodle">nacular/doodle</a></li>
<li><a href="https://github.com/pdvrieze/xmlutil">pdvrieze/xmlutil</a></li>
<li><a href="https://github.com/prof18/RSS-Parser">prof18/RSS-Parser</a></li>
<li><a href="https://github.com/rjaros/kilua">rjaros/kilua</a></li>
<li><a href="https://github.com/SciProgCentre/kmath">SciProgCentre/kmath</a></li>
<li><a href="https://github.com/SnipMeDev/Highlights">SnipMeDev/Highlights</a></li>
<li><a href="https://github.com/square/wire">square/wire</a></li>
</ul>

</details>

As a result, I found that

- Genuine tail calls, construttor/accumulator patterns are almost not found in real Kotlin codebases as far as I searched.
- Most recursion needs CPS
  - 13 of 18 repositories contain recursive functions. The dominant pattern is a recursive call inside a loop body or a higher-order function like `forEach`, `map`, or `any`.

### How library authors avoid recursion

I found that some library authors have engineered the recursion away.

- [JetBrains/markdown](https://github.com/JetBrains/markdown) parses block structure with no recursion at all. The parser core, [`MarkerProcessor`](https://github.com/JetBrains/markdown/blob/master/src/commonMain/kotlin/org/intellij/markdown/parser/MarkerProcessor.kt#L15), maintains an explicit stack of open blocks and pushes and pops it in a flat scan loop.

- The [kudzu](https://github.com/copper-leaf/kudzu) parser combinator library makes every parser a `DeepRecursiveFunction` [by declaration](https://github.com/copper-leaf/kudzu/blob/main/kudzu-core/src/commonMain/kotlin/com/copperleaf/kudzu/parser/ParseFunction.kt), moving recursion to the heap via the coroutine machinery.

- Some libraries still crash on deep input.
  - Apollo's [GraphQL parser](https://github.com/apollographql/apollo-kotlin/blob/main/libraries/apollo-ast/src/commonMain/kotlin/com/apollographql/apollo/ast/internal/Parser.kt) overflows around nesting depth 2,000
  - Stdlib regex matcher recurses per input character with an open crash report ([KT-63689](https://youtrack.jetbrains.com/issue/KT-63689)).

Libraries that rewrote recursion by hand paid a cost in development effort and, in kudzu's case, runtime performance. Libraries that did not rewrite it crash on deep input. The compiler lowerings can automate these rewrites.
