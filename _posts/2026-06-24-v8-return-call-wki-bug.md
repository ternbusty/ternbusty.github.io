---
layout: post
title: "Benchmarking Kotlin/Wasm Tail Calls on Real Projects"
date: 2026-06-24
categories: [Technology, Compiler]
tags: [Kotlin, WebAssembly, V8, GSoC]
---

## Summary

The [Kotlin/Wasm tail call PR](https://ternbusty.github.io/posts/gsoc-wasm-tail-calls.html) emits native Wasm `return_call` / `return_call_ref` at tail-position call sites. [Microbenchmarks](https://github.com/ternbusty/wasm-tail-call-bench) confirmed the expected speedup for deep recursion. However, applying the same compiler to four real Kotlin/Wasm workloads produced the opposite result on V8. Every workload either slowed down or stayed flat.

The slowdown turned out to be a V8 bug, not an inherent cost of tail calls. V8's JIT compiler inlines Well-Known Imports (WKI) such as `wasm:js-string` builtins when it sees a regular `call`, but skipped that optimization for `return_call`. Kotlin compiles string operations to thin wrappers around these builtins, and the tail call compiler rewrites the forwarding call inside each wrapper to `return_call`. The result was that every string operation fell off the fast path and went through the JS-Wasm bridge instead.

I [reported the bug and submitted a fix](https://chromium-review.googlesource.com/c/v8/v8/+/7989752) to V8. With the fix applied, the slowdown disappeared and all workloads returned to parity with the baseline. Parity, not improvement. None of the benchmarked workloads contain meaningful amounts of code in tail position. Compose UI trees are shallow, and the parser benchmarks wrap every recursive return in a constructor. To turn tail calls into a throughput win on real code, the compiler needs to create new tail-call-eligible sites that do not exist in the source. Continuation-passing style (CPS) transforms and tail modulo cons (TMC) rewrites, as explored in OCaml and other ML compilers, are the next step.

## Four workloads, all slower or flat

I benchmarked four Kotlin/Wasm projects on V8 (D8 / Node.js), comparing the tail-call branch against master.

### [Compose Multiplatform](https://github.com/JetBrains/compose-multiplatform/tree/master/benchmarks/multiplatform)

[All 11 benchmarks](https://github.com/JetBrains/compose-multiplatform/blob/master/benchmarks/multiplatform/benchmarks/src/commonMain/kotlin/Benchmarks.kt) ran on D8, 5 iterations each (warmup 50, 200 measured frames). Every one was slower with tail calls enabled.

| Benchmark | OFF (μs) | ON (μs) | ON / OFF |
|---|---:|---:|---:|
| AnimatedVisibility | 117.5 | 125.7 | +7.0% |
| CanvasDrawing | 11,928 | 12,458 | +4.4% |
| HeavyShader | 3,016 | 3,016 | ±0% |
| LazyGrid | 8,469 | 9,054 | +6.9% |
| LazyGrid-ItemLaunchedEffect | 8,247 | 9,026 | +9.4% |
| LazyGrid-SmoothScroll | 873 | 1,007 | +15.3% |
| LazyGrid-SmoothScroll-ItemLaunchedEffect | 846 | 1,061 | +25.4% |
| LazyList | 201 | 228 | +13.3% |
| MultipleComponents-NoVectorGraphics | 363 | 382 | +5.4% |
| TextLayout | 71,056 | 79,273 | +11.6% |
| VisualEffects | 62,839 | 65,649 | +4.5% |

### [JetBrains/markdown](https://github.com/JetBrains/markdown)

This parser processes nested structures (blockquotes, lists) by recursing through [`applyToNextLine`](https://github.com/JetBrains/markdown/blob/master/src/commonMain/kotlin/org/intellij/markdown/parser/constraints/CommonMarkdownConstraints.kt#L49) / [`processToken`](https://github.com/JetBrains/markdown/blob/master/src/commonMain/kotlin/org/intellij/markdown/parser/markerblocks/MarkerBlockImpl.kt#L32), and its hot path is dominated by Kotlin `String` operations that compile to `wasm:js-string` builtin imports. Measured on Node.js, 10-run medians.

| Benchmark | OFF (ops/sec) | ON (ops/sec) | ON / OFF |
|---|---:|---:|---:|
| parseNestedBlockquote (depth 200) | 2.465 | 1.935 | −21.5% |
| parseNestedList (depth 500) | 5.871 | 5.378 | −8.4% |
| parseRealisticMarkdown (50 sections) | 288.092 | 253.945 | −11.9% |
| parseUnmatchedBrackets (5000 brackets) | 435.057 | 432.786 | −0.5% |

### [rhizomedb](https://github.com/zolotov/kmp-bugs)

The DB operations ([`DbBench`](https://github.com/zolotov/kmp-bugs/blob/master/rhizomedb-test/src/commonMain/kotlin/com/jetbrains/rhizomedb/benchmark/DbBench.kt), [`TrieBenchmark`](https://github.com/zolotov/kmp-bugs/blob/master/rhizomedb-test/src/commonMain/kotlin/com/jetbrains/rhizomedb/benchmark/TrieBenchmark.kt)) were within ±0.5% of baseline. The rql query parser showed the worst slowdown of all four workloads. Its [`parsePrecedence`](https://github.com/zolotov/kmp-bugs/blob/master/rhizomedb/src/commonMain/kotlin/com/jetbrains/rhizomedb/rql/Parser.kt#L202-L256) is a Pratt-style recursive descent that calls itself at every precedence level, and each iteration of the parse loop performs string-based lexeme matching via `peek()`, `match()`, and `advance()`. `RqlParserBench` on D8 (V8 15.1.0):

| Benchmark | OFF (ops/sec) | ON (ops/sec) | ON / OFF |
|---|---:|---:|---:|
| parseNestedParens100 | 118,393 | 70,241 | −41% |
| parseNestedParens1000 | 12,668 | 7,599 | −40% |
| parseNestedParens5000 | 2,513 | 1,515 | −40% |
| parseNestedNot100 | 49,189 | 27,145 | −45% |
| parseNestedNot1000 | 4,925 | 2,791 | −43% |
| parseNestedNot5000 | 804 | 499 | −38% |
| parseLongChain1000 | 6,715 | 3,727 | −44% |

## The cause was V8, not tail calls

The slowdown was specific to V8's wasmJs target. Compiling the same markdown benchmark to wasmWasi and running it on the same V8 engine eliminated it entirely.

| Benchmark | OFF (ops/sec) | ON (ops/sec) | ON / OFF |
|---|---:|---:|---:|
| parseNestedBlockquote | 2.572 | 2.583 | +0.4% |
| parseNestedList | 6.065 | 6.101 | +0.6% |
| parseRealisticMarkdown | 302.536 | 304.329 | +0.6% |
| parseUnmatchedBrackets | 447.575 | 454.970 | +1.7% |

If `return_call` were inherently slower, wasmWasi would also slow down. It did not. The difference is that wasmJs imports Well-Known Imports like `wasm:js-string` `length` and `charCodeAt`, which V8's TurboFan normally inlines to skip the JS-Wasm bridge. wasmWasi implements string operations in pure Wasm and never touches this code path.

A `--prof` profile of the wasmJs run confirmed this hypothesis.

| Function | tail call OFF | tail call ON |
|---|---:|---:|
| parser hot path (`applyToNextLine`) | 31.3% | 20.2% |
| wasm-to-js bridge stubs | <1% | **20.9%** |
| `WebAssemblyStringLength` builtin | <1% | **14.2%** |

With tail calls enabled, ~35% of execution time was spent crossing the JS-Wasm bridge for string operations that should have been inlined.

## The bug in V8's Turboshaft graph builder

V8's Turboshaft graph builder ([`turboshaft-graph-interface.cc`](https://source.chromium.org/chromium/chromium/src/+/main:v8/src/wasm/turboshaft-graph-interface.cc)) handles `call` and `return_call` through separate methods, `CallDirect` and `ReturnCall`. `CallDirect` checks whether the callee is a Well-Known Import via `HandleWellKnownImport` and, if so, inlines the operation directly into the Turboshaft graph. `ReturnCall` had no such check. Every `return_call` to an imported function went through the bridge unconditionally.

Kotlin's String wrapper functions are thin forwarders to `wasm:js-string` builtins. The tail call compiler rewrites the forwarding call inside each wrapper from `call` to `return_call`, and each of those calls now bypassed TurboFan's WKI inlining.

## The fix and what it confirmed

The fix adds the same `HandleWellKnownImport` check to `ReturnCall` (+16 lines). When the callee is recognized as a single-result WKI, the inlined result is returned via `DoReturn` instead of going through the bridge.

A minimal WAT reproducer (50M iterations of `return_call` vs `call` to `wasm:js-string` `length`) showed a ~13.6x gap on stock V8 that disappeared on the patched build.

```
                      call              return_call
stock V8              ~2882 M ops/s     ~211 M ops/s
patched V8            ~2876 M ops/s     ~2883 M ops/s
```

Re-running the Kotlin benchmarks on the patched V8 confirmed that the slowdown was entirely caused by this bug. Both the markdown parser and the rql parser returned to parity with the baseline.

| Benchmark | OFF | ON (stock V8) | ON (patched V8) |
|---|---:|---:|---:|
| parseNestedBlockquote | 2.7 ops/s | 1.8 (−33%) | 2.7 (parity) |
| parseRealisticMarkdown | 325 ops/s | 238 (−27%) | 324 (parity) |
| parseNestedParens100 | 118,393 | 70,241 (−41%) | 118,045 (parity) |
| parseLongChain1000 | 6,715 | 3,727 (−44%) | 6,750 (parity) |

Parity, not improvement. The fix removed the artificial penalty, confirming that these workloads have no tail-call-eligible hot paths to benefit from.

## Why no improvement, and what comes next

None of the four workloads improved because none of them have significant amounts of code in tail position. Compose UI hierarchies are a few dozen levels deep at most. The markdown parser's recursion returns through `MarkerBlockImpl` constructors. The rql parser's [`parsePrecedence`](https://github.com/zolotov/kmp-bugs/blob/master/rhizomedb/src/commonMain/kotlin/com/jetbrains/rhizomedb/rql/Parser.kt#L202-L256) wraps every recursive return in an `Expression.UnaryOp` or `Expression.BinaryOp` constructor:

```kotlin
val operand = parsePrecedence(prefixPrecedence)
Expression.UnaryOp(operator, operand)   // not a tail call
```

The current tail call pass can only emit `return_call` for calls that are already in tail position in the IR. To make tail calls useful on code like this, the compiler needs to create new tail positions that do not exist in the source. OCaml 4.14's TMC (tail modulo cons) rewrites `Cons(x, f(y))` so that `f(y)` becomes a tail call by writing the result into a pre-allocated cell. A CPS (continuation-passing style) transform can generalize this further. Both are active areas of research in functional language compilers. Applying these transforms to Kotlin/Wasm IR is the next step for this project.

## Upstream status

- Chromium issue: [chromium:527088951](https://issues.chromium.org/issues/527088951)
- Gerrit CL: [v8/v8+/7989752](https://chromium-review.googlesource.com/c/v8/v8/+/7989752) (includes a mjsunit test)
