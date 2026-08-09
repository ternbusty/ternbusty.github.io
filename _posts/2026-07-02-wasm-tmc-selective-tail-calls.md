---
layout: post
title: "Kotlin/Wasm TMC: A Working Transform in Search of Real-World Code"
date: 2026-07-02
categories: [Technology, Compiler]
tags: [Kotlin, WebAssembly, Compiler, GSoC]
---

## Overview

The [coverage post](https://ternbusty.github.io/posts/wasm-tail-call-coverage.html) left tail modulo cons as a working prototype. This post makes it reviewable as [PR 7](https://github.com/ternbusty/kotlin/pull/7), a draft containing the transform, an opt-in `@kotlin.wasm.TailModCons` annotation with checked error semantics, and box tests.

## What TMC does

TMC targets recursion whose result feeds exactly one constructor.

```kotlin
fun copy(l: List): List = Cons(l.head, copy(l.tail))
```

This is not a tail call, so it overflows the host stack on deep inputs even with `-Xwasm-enable-tail-calls`.

I implemented the tail-modulo-cons transformation from Bour, Clément and Scherer's ["Tail Modulo Cons"](https://arxiv.org/abs/2102.09823), the paper behind the `[@tail_mod_cons]` feature merged into OCaml 4.14. The core idea is theirs unchanged. Allocate the constructor first with a hole in it, pass the hole's address down, and the recursive call becomes a true tail call that fills the hole. A machine-checked Coq/Iris correctness proof by [Allain, Bour, Clément, Pottier and Scherer](https://doi.org/10.1145/3704915) followed at POPL 2025.

OCaml's opt-in design carries over as well. The pass considers only functions annotated with the new `@kotlin.wasm.TailModCons`, and annotating a function whose shape it cannot handle is a compilation error at the function's location. Constant stack usage is a contract the author relies on, so a refactor that breaks the shape fails the build instead of resurfacing as a production stack overflow.

`WasmTailModConsLowering` tries two strategies per candidate, in order.

### DPS, destination-passing style

The function is split into a wrapper and a `$tmcDps` helper. The wrapper allocates the constructor with a hole, and the helper fills the hole and self-recurses in genuine tail position via `return_call`. This handles the direct constructor-argument shape, including `return when` bodies after normalisation.

### DPS-loop

For candidates whose post-effects reference neither the variables saved across the recursive call nor the recursive result, the recursion becomes a `while(true)` loop writing through mutable struct fields, with the deferred post-effects replayed at the base case. No helper function and no dependency on tail-call support.

In both strategies the pending work after the recursive call is a destination pointer and no frames exist, so a transformed function cannot run slower than its recursive original.

## Tail-call emission

Independently of `-Xwasm-enable-tail-calls`, tail calls inside the generated `$tmcDps` helpers are always emitted, since the transformation relies on `return_call` for bounded stack usage and the helpers only exist for annotated functions. A box test asserts at the instruction level that the DPS helper's self-call is `return_call` with no flag set.

## Applicability

The [coverage post](https://ternbusty.github.io/posts/wasm-tail-call-coverage.html) documents the applicability picture with code from the surveyed libraries. In short, the 15-library survey found zero self-recursive TMC shapes in idiomatic Kotlin. The shape that does exist in the wild is mutual-recursion cycles, in square/wire's option parser, xmlutil's XPath parser, Keval's grammar, and the stdlib regex pattern compiler, which overflows today on nesting depth around 2,000. The pass handles self-recursion and two-function cycles, while every surveyed cycle is larger, at four functions in wire, eleven in xmlutil, five in Keval, and three in the pattern compiler. There is ready-made theory for the extension. [Lorenzen and Leijen's "Tail Recursion Modulo Context"](https://doi.org/10.1145/3571233) from POPL 2023 generalizes TMC from constructor contexts to arbitrary evaluation contexts, which also covers the pattern compiler's field-write shape.

The transform works, composes with the tail-call infrastructure, and found no real-world payload waiting for it. The absence has a cause. Libraries that parse deeply nested input engineered their recursion away by hand long before a compiler could help, so the shapes TMC targets rarely survive to publication.
