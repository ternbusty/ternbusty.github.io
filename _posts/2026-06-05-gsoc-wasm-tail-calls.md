---
layout: post
title: "GSoC 2026: Native Wasm Tail Call Support in the Kotlin/Wasm Backend"
date: 2026-06-05
categories: [Technology, Compiler]
tags: [Kotlin, WebAssembly, Compiler, GSoC]
---

## Overview

The goal of [the project](https://summerofcode.withgoogle.com/programs/2026/projects/sJkheg4K) is to let the Kotlin/Wasm backend emit native Wasm tail call instructions (`return_call` and `return_call_ref`) at call sites that the existing `tailrec` lowering cannot reach. This covers mutual recursion, self recursion in functions where the developer did not annotate `tailrec`, virtually dispatched tail calls, interface dispatched tail calls, and any non self tail call. The motivating problem is that Wasm has no specified maximum stack depth and host engines impose their own ceilings, so any unbounded recursive structure other than a direct self recursive `tailrec` function currently risks trapping.

## Work status

### IR opcode primitives ([PR 1](https://github.com/ternbusty/kotlin/pull/1), open)

Adds `RETURN_CALL` (0x12) and `RETURN_CALL_INDIRECT` (0x13) to the [`WasmOp`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/wasm/wasm.ir/src/org/jetbrains/kotlin/wasm/ir/Operators.kt) enum. `RETURN_CALL_REF` (0x15) was already present. Adds `buildReturnCall` and `buildReturnCallRef` helpers on [`WasmExpressionBuilder`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/wasm/wasm.ir/src/org/jetbrains/kotlin/wasm/ir/WasmExpressionBuilder.kt) for the upcoming consumer in BodyGenerator. Removes the `@Ignore` on [`BinaryCodecTest.tail-call`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/wasm/wasm.ir/test/org/jetbrains/kotlin/wasm/ir/BinaryCodecTest.kt) so the upstream WebAssembly tail call spec test suite round trips through Kotlin's binary and text encoders against wabt. Includes a localized text emitter workaround for a known wabt 1.0.19 parser bug ([WebAssembly/wabt#2018](https://github.com/WebAssembly/wabt/issues/2018)).

### Static dispatch emission ([PR 2](https://github.com/ternbusty/kotlin/pull/2), open)

Adds [`WasmTailCallCollector`](https://github.com/ternbusty/kotlin/blob/e5d8961d9929ec6983c460602778d7be86f8d4a4/compiler/ir/backend.wasm/src/org/jetbrains/kotlin/backend/wasm/ir2wasm/WasmTailCallCollector.kt), a pre pass that walks an `IrFunction` body and collects every `IrCall` that lexically appears in tail position. The visitor topology mirrors [`TailRecursionCallsCollector`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/compiler/ir/backend.common/src/org/jetbrains/kotlin/backend/common/TailRecursionCallsCollector.kt) (covers `IrWhen` branches, `IrBlock` and `IrContainerExpression` tails, `IrReturn` children, and excludes `IrTry`) but drops the self call requirement and the tailrec specific filters. [BodyGenerator](https://github.com/ternbusty/kotlin/blob/e5d8961d9929ec6983c460602778d7be86f8d4a4/compiler/ir/backend.wasm/src/org/jetbrains/kotlin/backend/wasm/ir2wasm/codegenGenerators/BodyGenerator.kt) consumes the side table at its static dispatch emit site and swaps `call` for `return_call` when the call is in the set and the eligibility filter passes. The eligibility filter rejects constructor callees and requires matching Wasm result type signatures between caller and callee. A `WASM_ENABLE_TAIL_CALLS` configuration key (default on) gates the entire feature for fall back to plain calls when needed. Also passes `--enable-tail-call` to binaryen so the post compile `wasm-opt` step accepts the new opcodes.

### Virtual and interface dispatch ([PR 3](https://github.com/ternbusty/kotlin/pull/3), draft)

Extends the BodyGenerator change to the vtable virtual dispatch path and the itable interface dispatch path. Both produce `return_call_ref` from the typed funcref already loaded onto the stack. The receiver load, ref cast, and struct get sequences stay identical, only the terminal opcode changes. Drafted in the working branch, ready to split out once PR 2 review is settled.

### Stress and correctness tests ([PR 4](https://github.com/ternbusty/kotlin/pull/4), draft)

Mutual recursion at depths up to 1M, virtual dispatch bouncing across class hierarchies. Targets multiple JS engines via the existing WasmVM test runner. Will not include benchmark code since the standalone benchmark project lives outside the Kotlin tree.

## Design decisions

### Pre pass with side table, not flag threading

BodyGenerator extends `IrVisitorVoid` with no context parameter. Threading an `isTailPosition` flag would require updating every container site (`IrWhen` branches, `IrBlock` last statement, `IrReturn` children, `IrTry` skip, Unit tail handling) with push and pop discipline. The pre pass produces a `Set<IrCall>` once per function and BodyGenerator queries it at emit sites. This keeps the existing visitor untouched and centralizes eligibility filters in one place.

### Tailrec stays as a loop

[`TailrecLowering`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/compiler/ir/backend.common/src/org/jetbrains/kotlin/backend/common/lower/TailrecLowering.kt) runs in [`WasmLoweringPhases`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/compiler/ir/backend.wasm/src/org/jetbrains/kotlin/backend/wasm/WasmLoweringPhases.kt) before BodyGenerator, so direct self recursive `tailrec` functions are already rewritten as `do while` loops by the time codegen sees them. The loop form is faster and produces smaller code, so leaving it alone is the right call. Native tail calls target what loop transformation cannot express. The benchmarks below confirm this: at depth 10,000 the same arithmetic body runs at 270k ops/sec via `tailrec` and 220k ops/sec via the unmarked native tail call equivalent, so the loop lowering retains about a 20% advantage even after the native version benefits from frame reuse.

## Verification done

- [`BinaryCodecTest.tail-call`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/wasm/wasm.ir/test/org/jetbrains/kotlin/wasm/ir/BinaryCodecTest.kt) round trips the Wasm tail call proposal spec test data through Kotlin's binary and text encoders against wabt.
- [`wasmIrCheckForTailCalls.kt`](https://github.com/ternbusty/kotlin/blob/e5d8961d9929ec6983c460602778d7be86f8d4a4/compiler/testData/codegen/box/wasm-ir-checks/wasmIrCheckForTailCalls.kt) asserts the expected `return_call` / `return_call_ref` emission for the static dispatch, when branch, Unit return, try catch exclusion, tailrec preservation, and mutual recursion patterns, and runs a depth 100k mutual recursion under V8 as an end to end check.
- Existing [`Diagnostics.Functions.TailRecursion`](https://github.com/JetBrains/kotlin/tree/77558ff8195834b77e49fe1709b0ce7ef4660489/compiler/testData/codegen/box/diagnostics/functions/tailRecursion) and [`Coroutines.FeatureIntersection.Tailrec`](https://github.com/JetBrains/kotlin/tree/77558ff8195834b77e49fe1709b0ce7ef4660489/compiler/testData/codegen/box/coroutines/featureIntersection/tailrec) suites pass, confirming no regression in the `tailrec` lowering path.

## Benchmarks

Used [`kotlinx-benchmark`](https://github.com/kotlin/kotlinx-benchmark) 0.4.17 in a [standalone gradle project](https://github.com/ternbusty/wasm-tail-call-bench) that consumes the locally installed compiler from [`feature/wasm-tail-calls/04-stress-tests`](https://github.com/ternbusty/kotlin/tree/feature/wasm-tail-calls/04-stress-tests). Engine is the Node.js binary shipped by the Kotlin/Wasm gradle plugin (V8 in Node 25, with default `--wasm-inlining` enabled). 3 warmups and 5 iterations per data point. Comparison `OFF` was produced by switching the Kotlin checkout to `master` (with no PR in this series applied) and reinstalling.

Five patterns are measured. [Static mutual recursion](https://github.com/ternbusty/wasm-tail-call-bench/blob/main/src/wasmJsMain/kotlin/bench/StaticMutualRecursion.kt), [Non `tailrec` self recursion](https://github.com/ternbusty/wasm-tail-call-bench/blob/main/src/wasmJsMain/kotlin/bench/TailrecVsNative.kt),
[Virtual dispatch mutual](https://github.com/ternbusty/wasm-tail-call-bench/blob/main/src/wasmJsMain/kotlin/bench/VirtualMutualRecursion.kt), [Interface dispatch mutual](https://github.com/ternbusty/wasm-tail-call-bench/blob/main/src/wasmJsMain/kotlin/bench/InterfaceMutualRecursion.kt), and [`tailrec` lowered to a loop](https://github.com/ternbusty/wasm-tail-call-bench/blob/main/src/wasmJsMain/kotlin/bench/TailrecVsNative.kt).

Throughput in operations per second, higher is better. `ON / OFF` is the ratio.

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

### Beyond the host stack limit

The numbers above stay within depths that V8 can handle in either configuration. The case the feature actually exists for is the one V8 cannot survive without it. To probe that directly I added a [`DepthStress`](https://github.com/ternbusty/wasm-tail-call-bench/blob/main/src/wasmJsMain/kotlin/bench/DepthStress.kt) benchmark class that calls each of the four patterns at depth 1,000,000.

On `master` the depth 1M run throws `RangeError: Maximum call stack size exceeded` partway through the recursion and kills the Node process.

```
… bench.DepthStress.interfaceMutualAt1M
RangeError: Maximum call stack size exceeded
    at null.<anonymous> (wasm://wasm/000f163a:1:149024)
    at null.<anonymous> (wasm://wasm/000f163a:1:149096)
    at null.<anonymous> (wasm://wasm/000f163a:1:195899)
    at null.<anonymous> (wasm://wasm/000f163a:1:195911)
    at null.<anonymous> (wasm://wasm/000f163a:1:195911)
    ...
```

With the feature enabled all four patterns complete.

## Process so far

Initial design exploration was bottom up. I read [`TailrecLowering`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/compiler/ir/backend.common/src/org/jetbrains/kotlin/backend/common/lower/TailrecLowering.kt), [`BodyGenerator`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/compiler/ir/backend.wasm/src/org/jetbrains/kotlin/backend/wasm/ir2wasm/codegenGenerators/BodyGenerator.kt), [`Operators.kt`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/wasm/wasm.ir/src/org/jetbrains/kotlin/wasm/ir/Operators.kt), and the [`WasmLoweringPhases`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/compiler/ir/backend.wasm/src/org/jetbrains/kotlin/backend/wasm/WasmLoweringPhases.kt) ordering, then sketched the eligibility filter list against the failure modes (try catch exclusion, signature mismatch, intrinsic handling, constructor receiver issues). After that the work has been one PR at a time, each gated on local tests and a regression sweep.

There were two unexpected findings during the work.

1. The wabt 1.0.19 parser bug (WebAssembly/wabt#2018) blocks the spec test even after the opcode is added. The simplest fix is a localized text emitter workaround for `return_call_indirect`. I investigated upgrading wabt, but the upgrade chains into a testsuite revision bump that surfaces preexisting IR layer text emitter and parser bugs around reference types canonical forms. Some of those tests live in files that previously passed (`binary.wast` and `binary-leb128.wast` grew bulk memory binary edge cases), so skipping them would regress MVP coverage. Belongs as a separate effort coupled with an IR layer text emitter and parser refresh.

2. [`BinaryenConfig.kt`](https://github.com/JetBrains/kotlin/blob/77558ff8195834b77e49fe1709b0ce7ef4660489/wasm/wasm.config/src/org/jetbrains/kotlin/platform/wasm/BinaryenConfig.kt) did not pass `--enable-tail-call` to `wasm-opt`. Without that flag, any Kotlin/Wasm module containing `return_call` is rejected by binaryen with `unexpected false: return_call* requires tail calls`. Added the one line fix as a separate commit on PR 2. This is a hard requirement for the feature to work end to end.

## Follow ups

Three items I want to track explicitly.

- **wabt 1.0.33 upgrade**. The text emitter workaround in [`WasmIrToText.kt`](https://github.com/ternbusty/kotlin/blob/e5d8961d9929ec6983c460602778d7be86f8d4a4/wasm/wasm.ir/src/org/jetbrains/kotlin/wasm/ir/convertors/WasmIrToText.kt) exists because wabt 1.0.19 only accepts the canonical `return_call_indirect (type X)` form. The parser was fixed upstream by [WebAssembly/wabt#2049](https://github.com/WebAssembly/wabt/pull/2049) and wabt 1.0.33+ accepts both forms. Once the Kotlin test infrastructure moves to a newer wabt, the workaround branch is one line to delete and `WasmOp.RETURN_CALL_INDIRECT` should be added to the reversed immediate set alongside `CALL_INDIRECT` and `TABLE_INIT`. The blocker is that bumping wabt also bumps the upstream spec testsuite, which surfaces preexisting IR layer text emitter and parser issues unrelated to this work, so the upgrade belongs in its own PR.
- **Decision on whether to expose `WASM_ENABLE_TAIL_CALLS` externally**. The configuration key exists but is currently internal. There is no CLI argument, no Kotlin Gradle Plugin DSL setter, and no `-P` property bridge, which is why the benchmark project in this writeup had to swap branches to compare ON and OFF. Exposing the key via something like `-Xwasm-enable-tail-calls=false` would let downstream projects opt out without rebuilding the compiler, but doing so adds a public surface to the compiler API. Whether that is desirable, what the naming should look like, and whether the flag should be experimental or stable are all questions for the Kotlin team rather than something to commit to unilaterally.
