---
layout: post
title: "Kotlin/Wasm TMC: A Working Transform in Search of Real-World Code"
date: 2026-07-02
categories: [Technology, Compiler]
tags: [Kotlin, WebAssembly, Compiler, GSoC]
---

## Overview

The [coverage post](https://ternbusty.github.io/posts/wasm-tail-call-coverage/) left tail modulo cons as a working prototype without demonstrated real-world targets. This post turns that prototype into something reviewable. It covers the transform strategies, an opt-in `@kotlin.wasm.TailModCons` annotation with checked error semantics, and a conservative emission policy that protects V8 inlining, all prepared as [PR 7](https://github.com/ternbusty/kotlin/pull/7). The survey in the coverage post answers the applicability question, and the conclusion it forced, rescuing the recursion that cannot be a tail call at all, gets its own post next.

## What TMC does now

TMC targets recursion whose result feeds exactly one constructor.

```kotlin
fun copy(l: List): List = Cons(l.head, copy(l.tail))
```

This is not a tail call, so it overflows the host stack on deep inputs even with `-Xwasm-enable-tail-calls`.

I implemented the tail-modulo-cons transformation from Bour, Clément and Scherer's ["Tail Modulo Cons"](https://arxiv.org/abs/2102.09823), the paper behind the `[@tail_mod_cons]` feature merged into OCaml 4.14. The core idea is theirs unchanged. Allocate the constructor first with a hole in it, pass the hole's address down, and the recursive call becomes a true tail call that fills the hole. The transformation also has a machine-checked correctness proof in Coq/Iris by [Allain, Bour, Clément, Pottier and Scherer (POPL 2025)](https://doi.org/10.1145/3704915), which is comforting when debugging, since any misbehavior is by construction a bug in my implementation.

One design point carries over as well. OCaml makes TMC opt-in per function with an annotation and reports an error when the annotation cannot apply, which removes regression risk by construction. This pass does the same: only functions annotated with a new `@kotlin.wasm.TailModCons` are considered (there is no compilation-wide flag; the annotation is the whole contract), and annotating a function whose shape the transformation cannot handle is a compilation error at the function's location. The constant-stack property is a contract the author relies on, so a refactor that breaks the shape fails the build instead of resurfacing as a production stack overflow.

`WasmTailModConsLowering` tries two strategies per candidate, in order.

### DPS (destination-passing style)

The function is split into a wrapper and a `$tmcDps` helper. The wrapper allocates the constructor with a hole, and the helper fills the hole and self-recurses in genuine tail position via `return_call`. This handles the direct constructor-argument shape, including `return when` bodies after normalisation.

### DPS-loop

For candidates whose post-effects reference neither the variables saved across the recursive call nor the recursive result, the recursion becomes a `while(true)` loop writing through mutable struct fields, with the deferred post-effects replayed at the base case. No helper function and no dependency on tail-call support.

Functions that match neither shape are left untouched, so partial applicability never changes semantics. In both strategies the pending work after the recursive call is a destination pointer and no frames exist, so a transformed function cannot run slower than its recursive original.

### An approach tried and set aside: the explicit-stack fallback

I also built a third strategy for candidates that DPS cannot express, constructor wraps surrounded by pre-effects and post-effects. It saves the live variables into an explicit stack (a WasmGC struct linked list) and drives the body in a loop, which makes it a defunctionalized-CPS conversion in miniature: the continuation lives in a data frame instead of a destination pointer. It works, and a parser-shaped probe that overflows around depth 2,000 without it runs to depth 1,000,000 with it (synthetic probe modeled on real parser code).

It is set aside rather than shipped here because its cost profile is the opposite of TMC's. It allocates a frame per recursion level with no depth threshold, so transformed functions may run slower on shallow inputs, and the same defunctionalized-frame idea reappears in generalized form (with a hybrid depth threshold that fixes the shallow cost) as the stackless machinery in the next post. The implementation and its box tests are preserved as [a separate draft](https://github.com/ternbusty/kotlin/pull/12).

## Selective tail-call emission

The [V8 investigation](https://ternbusty.github.io/posts/v8-return-call-wki-bug/) established that `return_call` prevents V8 from inlining the callee into the caller, which regresses code that relies on inlining of small hot callees. The TMC PR is therefore conservative about emission. Unrestricted emission stays behind `-Xwasm-enable-tail-calls`, and independently of any flag, tail calls inside the generated `$tmcDps` helpers are always emitted, since the transformation relies on `return_call` for bounded stack usage and the helpers only exist for annotated functions.

Ordinary code, including self-recursive and virtually dispatched tail calls, is left untouched unless `-Xwasm-enable-tail-calls` requests unrestricted emission. A box test asserts at the instruction level that the DPS helper's self-call is `return_call` with no flag set.

## Applicability

The [coverage post](https://ternbusty.github.io/posts/wasm-tail-call-coverage/) documents the applicability picture in detail, with code from the surveyed libraries. In short, the 15-library survey found zero self-recursive TMC shapes in idiomatic Kotlin. The shape that does exist in the wild is mutual-recursion cycles (square/wire's option parser, xmlutil's XPath parser, Keval's grammar, and the stdlib regex pattern compiler, which overflows today on nesting depth around 2,000), and the pass handles self-recursion and two-function cycles today, while every surveyed cycle is larger (four functions in wire, eleven in xmlutil, five in Keval, three in the pattern compiler). There is ready-made theory for the extension. [Lorenzen and Leijen's "Tail Recursion Modulo Context" (POPL 2023)](https://doi.org/10.1145/3571233) generalizes TMC from constructor contexts to arbitrary evaluation contexts, which also covers the pattern compiler's field-write shape.

The transform works, composes with the tail-call infrastructure, and found no real-world payload waiting for it. The survey's more useful output was the finding about how libraries cope, written up in the coverage post. Libraries that parse deeply nested input have engineered their recursion away by hand, into manual stacks (JetBrains/markdown) or `DeepRecursiveFunction` (kudzu), and the code that did not crashes today (Apollo's parser, the stdlib regex matcher with open issue [KT-63689](https://youtrack.jetbrains.com/issue/KT-63689)). Rescuing those two groups, the ones paying a runtime cost for the rewrite and the ones still crashing, is the next post.

## Status

[PR 7](https://github.com/ternbusty/kotlin/pull/7) (draft) contains the TMC lowering, the `@TailModCons` annotation with its error diagnostics, and box tests.

