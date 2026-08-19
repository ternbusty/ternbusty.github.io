---
layout: post
title: "GSoC 2026 Final Report: Tail call support in the Kotlin/Wasm backend"
date: 2026-08-19
categories: [Technology, Compiler]
tags: [Kotlin, WebAssembly, Compiler, GSoC]
---

## Project

- Project link: [Tail call support in the Kotlin/Wasm backend](https://summerofcode.withgoogle.com/programs/2026/projects/sJkheg4K)
- Organization: Kotlin Foundation
- Contributor: Ayako Hayasaka
- Mentor: Charlie Zhang, JetBrains

## Description

This project integrates the WebAssembly [tail call proposal](https://github.com/WebAssembly/tail-call/blob/main/proposals/tail-call/Overview.md) into the Kotlin/Wasm compiler backend. Wasm's call stack limit is unspecified and varies across host engines. Kotlin's tailrec rewrites simple self-recursion into a loop, but it cannot handle mutual recursion or indirect calls. The tail call proposal adds return_call and return_call_ref instructions that reuse the caller's frame, reducing stack consumption from O(n) to O(1) regardless of recursion structure. I implemented these instructions in the backend so that the compiler detects calls in tail position and emits the corresponding Wasm tail call instruction.

## What work was done

### Merged upstream

[JetBrains/kotlin#6396](https://github.com/JetBrains/kotlin/pull/6396)

This PR adds the `-Xwasm-enable-tail-calls` compiler flag. With it enabled, the compiler detects calls in tail position and emits return_call for static dispatch and return_call_ref for virtual and interface dispatch. This is the main contribution of this project.

#### Benchmarking

I measured these with [kotlinx-benchmark](https://github.com/kotlin/kotlinx-benchmark) in a [standalone project](https://github.com/ternbusty/wasm-tail-call-bench), running on V8 via Node 25.

| pattern | depth | OFF | ON | ON / OFF |
|--------|------:|----:|---:|---------:|
| static mutual recursion | 100 | 18,528,953 | 21,064,222 | 1.14 x |
| static mutual recursion | 1,000 | 1,009,305 | 2,471,570 | 2.45 x |
| static mutual recursion | 10,000 | 92,452 | 251,853 | 2.72 x |
| non `tailrec` self recursion | 100 | 12,365,157 | 20,727,011 | 1.68 x |
| non `tailrec` self recursion | 1,000 | 526,190 | 2,243,492 | 4.26 x |
| non `tailrec` self recursion | 10,000 | 51,606 | 223,295 | 4.33 x |
| virtual dispatch mutual | 100 | 11,533,447 | 13,255,188 | 1.15 x |
| virtual dispatch mutual | 1,000 | 658,584 | 1,097,260 | 1.67 x |
| virtual dispatch mutual | 10,000 | 60,498 | 102,230 | 1.69 x |
| interface dispatch mutual | 100 | 1,849,485 | 3,956,255 | 2.14 x |
| interface dispatch mutual | 1,000 | 182,777 | 428,991 | 2.35 x |
| interface dispatch mutual | 10,000 | 14,025 | 42,066 | 3.00 x |
| `tailrec` lowered to a loop | 100 | 30,714,997 | 30,242,067 | 0.98 x |
| `tailrec` lowered to a loop | 1,000 | 2,650,139 | 2,557,474 | 0.97 x |
| `tailrec` lowered to a loop | 10,000 | 272,930 | 272,979 | 1.00 x |

![Per-call cost at depth 10,000](/assets/img/2026-06-05-tail-call-chart.svg)

-  Every non `tailrec` benchmarks gets faster with the feature on, and the gain grows with depth. Without the feature each recursive call pushes a new frame. With the feature each tail call reuses the caller frame, and the per call cost stops growing with depth.
- `tailrec` loops are at parity, confirming the design choice to leave the existing lowering alone. Native tail calls only handle what loop lowering cannot express.
- The absolute throughput ordering is static < self < virtual < interface in terms of per call cost, which mirrors the underlying dispatch chain. Static is a single `call` instruction, virtual adds a vtable struct get, and interface goes through vtable plus a ref cast.
- At depth 1,000,000, V8 throws `RangeError: Maximum call stack size exceeded` without tail calls. With tail calls, all four patterns complete.

### V8 bug fix

[[wasm] Apply WKI fast path for return_call to imported functions](https://chromium-review.googlesource.com/c/v8/v8/+/7989752)

Benchmarking the tail call compiler on [Compose Multiplatform](https://github.com/JetBrains/compose-multiplatform), [JetBrains/markdown](https://github.com/JetBrains/markdown), and [rhizomedb](https://github.com/zolotov/kmp-bugs) showed up to 45% slowdown on V8 as described in [this blog post](https://ternbusty.github.io/posts/v8-return-call-wki-bug.html).

I traced the cause to V8's Turboshaft graph builder, where ReturnCall did not check `HandleWellKnownImport`. `CallDirect` inlines `wasm:js-string` builtins to skip the JS-Wasm bridge, but ReturnCall always went through the bridge. Kotlin compiles string operations to thin wrappers around these builtins, and the tail call compiler rewrites the forwarding call inside each wrapper to return_call, so every string operation fell off the fast path. The fix adds the same WKI check to `ReturnCall` and makes the slowdown disappear.

## What's left to do

### [#19 callRef tail calls](https://github.com/ternbusty/kotlin/pull/19)

Function references like `::foo` dispatch through an invoke bridge that was not emitting tail calls even when the call was in tail position. In this PR, I modified the codegen to emit return_call_ref when the Wasm-level return types match. This covers indirect higher-order calls through function references.

### [#16 Accumulator recursion lowering](https://github.com/ternbusty/kotlin/pull/16)

When a recursive call is wrapped in an associative operator like `return 1 + self(n-1)`, it is not in tail position. In this PR, the lowering rewrites the function to carry an intermediate result so that the recursive call moves to tail position. It covers plus, times, and, or, xor on Int/Long and plus on String.

## Explored

I tried two additional approaches so that the compiler emits more `return_call`.

### [#14 Tail-modulo-cons lowering](https://github.com/ternbusty/kotlin/pull/14)

Based on [this paper](https://doi.org/10.1145/3704915), I created an experimental implemetation of Tail-modulo-cons lowering.

When a recursive call is wrapped in a constructor like `return Cons(x, self(n-1))`, it is not in tail position. In this PR, the lowering rewrites such functions into destination-passing style, where the constructor is allocated first with a null placeholder, the recursion runs as a tail call, and the result is patched in afterward. It handles both self-recursion and mutual recursion cycles of any size, and reports a compilation error when the pattern cannot be transformed.

### [#20 CPS lowering](https://github.com/ternbusty/kotlin/pull/20)

This lowering handles recursive calls that none of the above patterns cover by rewriting them into continuation-passing style. I defunctionalize the continuation into typed heap frames and a trampoline loop. The prototype passes tests, but each recursive call allocates one heap frame, leading to slowdowns. I think I should introduce a hybrid approach in which this approach is only applied when the depth is more than a threshold. It needs more performance tuning.

## Acknowledgement

Thank you to my mentor Charlie Zhang san for his guidance throughout the project. He pointed me to how to take benchmarks early on, which led to the V8 bug discovery. He also sent me the papers that shaped the TMC lowerings. I also thank other maintainers for taking time to review the PR, Filipp Zhinkin san for reviewing [my onboarding PR](https://github.com/JetBrains/kotlin/pull/6015), and the Kotlin Foundation and Google Summer of Code for making this project possible.
