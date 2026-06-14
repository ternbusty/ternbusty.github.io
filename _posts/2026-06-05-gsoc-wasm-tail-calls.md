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

Adds `RETURN_CALL` (0x12) and `RETURN_CALL_INDIRECT` (0x13) to the `WasmOp` enum. `RETURN_CALL_REF` (0x15) was already present. Adds `buildReturnCall` and `buildReturnCallRef` helpers on `WasmExpressionBuilder` for the upcoming consumer in BodyGenerator. Removes the `@Ignore` on `BinaryCodecTest.tail-call` so the upstream WebAssembly tail call spec test suite round trips through Kotlin's binary and text encoders against wabt. Includes a localized text emitter workaround for a known wabt 1.0.19 parser bug (WebAssembly/wabt#2018).

### Static dispatch emission ([PR 2](https://github.com/ternbusty/kotlin/pull/2), open)

Adds `WasmTailCallCollector`, a pre pass that walks an `IrFunction` body and collects every `IrCall` that lexically appears in tail position. The visitor topology mirrors `TailRecursionCallsCollector` (covers `IrWhen` branches, `IrBlock` and `IrContainerExpression` tails, `IrReturn` children, and excludes `IrTry`) but drops the self call requirement and the tailrec specific filters. BodyGenerator consumes the side table at its static dispatch emit site and swaps `call` for `return_call` when the call is in the set and the eligibility filter passes. The eligibility filter rejects constructor callees and requires matching Wasm result type signatures between caller and callee. A `WASM_ENABLE_TAIL_CALLS` configuration key (default on) gates the entire feature for fall back to plain calls when needed. Also passes `--enable-tail-call` to binaryen so the post compile `wasm-opt` step accepts the new opcodes.

### Virtual and interface dispatch ([PR 3](https://github.com/ternbusty/kotlin/pull/3), draft)

Extends the BodyGenerator change to the vtable virtual dispatch path and the itable interface dispatch path. Both produce `return_call_ref` from the typed funcref already loaded onto the stack. The receiver load, ref cast, and struct get sequences stay identical, only the terminal opcode changes. Drafted in the working branch, ready to split out once PR 2 review is settled.

### Stress and correctness tests ([PR 4](https://github.com/ternbusty/kotlin/pull/4), draft)

Mutual recursion at depths up to 1M, virtual dispatch bouncing across class hierarchies. Targets multiple JS engines via the existing WasmVM test runner. Will not include benchmark code since the standalone benchmark project lives outside the Kotlin tree.

## Design decisions

### Pre pass with side table, not flag threading

BodyGenerator extends `IrVisitorVoid` with no context parameter. Threading an `isTailPosition` flag would require updating every container site (`IrWhen` branches, `IrBlock` last statement, `IrReturn` children, `IrTry` skip, Unit tail handling) with push and pop discipline. The pre pass produces a `Set<IrCall>` once per function and BodyGenerator queries it at emit sites. This keeps the existing visitor untouched and centralizes eligibility filters in one place.

### Tailrec stays as a loop

`TailrecLowering` runs in `WasmLoweringPhases` before BodyGenerator, so direct self recursive `tailrec` functions are already rewritten as `do while` loops by the time codegen sees them. The loop form is faster and produces smaller code, so leaving it alone is the right call. Native tail calls target what loop transformation cannot express. Benchmarks confirmed parity, with `tailrec` slightly faster than the unmarked native tail call equivalent across all depths.

### Eligibility filtered at emit time

The pre pass deliberately returns a superset based on syntactic tail position. Per call eligibility (signature equality, constructor callee, intrinsic) is checked at the emit site in `generateCall` because it requires Wasm level type information. This separation keeps the pre pass small and reusable.

The non obvious item on that list is the constructor exclusion, which actually exists in two places. The `WasmTailCallCollector` returns an empty set when the enclosing function is a constructor, and `isEligibleForTailCall` rejects calls whose callee is a constructor. Both checks point at the same asymmetry. A Kotlin constructor has IR return type `Unit`, but the Wasm function the backend emits for it has a return signature that includes the constructed object. The backend achieves this by appending a load of local 0 (the receiver) right before the `RETURN` opcode in `visitFunctionReturn`, so the emitted Wasm function effectively has signature `(params...) -> (ref $ClassType)` even though the IR view says `(params...) -> Unit`.

On the caller side, consider a class whose `init` block calls something in tail position.

```kotlin
class A {
    init {
        finishInit()
    }
}

fun finishInit() { /* ... */ }
```

If we tried to emit `return_call $finishInit` for the call to `finishInit`, the trailing `local.get 0` and `return` that push the receiver would never execute. The constructor would terminate without ever putting the constructed object on the stack, and any caller of `A()` would see a malformed result. The collector ducks the entire question by returning an empty candidate set when the enclosing function is a constructor.

On the callee side, consider a function that returns a freshly constructed object.

```kotlin
fun makeA(): A = A()
```

The call to `A()` is an `IrConstructorCall`, not an `IrCall`, so the `call is IrCall` check catches it directly. The reason the `callee is IrConstructor` check is also there is to handle the case where a regular `IrCall` ends up resolving to a constructor through `realOverrideTarget` chasing. It is rare but possible in synthesized code.

If we somehow got past the first check and arrived at the signature comparison without the constructor guard, the comparison would lie. The check uses `wasmModuleTypeTransformer.transformResultType(callee.returnType)` to compute the callee's Wasm result types. For an `IrConstructor` the IR return type is `Unit`, so this gives an empty list. But the actual emitted Wasm signature is `(ref $ClassType)`. The check would conclude that a Unit returning caller has the same signature as a constructor callee, accept the tail call, and emit a `return_call` that drops the caller frame and jumps to a function whose actual signature wants the receiver to be pushed.

```kotlin
// imagine without the callee constructor check
fun warmCache() {
    Cache()
}
```

Wasm would validate `warmCache` as returning nothing, the call site as `return_call $Cache.<init>`, and the `Cache` constructor as actually returning `(ref $Cache)`. At runtime the receiver gets pushed by `Cache`'s epilogue but `warmCache`'s caller is expecting nothing on the stack. The result is either a validation error caught at module load time or a stack discipline violation at runtime depending on which side the engine trusts.

The constructor guard shuts that path down by rejecting any tail call whose callee is a constructor, regardless of how the signature comparison would have come out.

The whole asymmetry comes from the choice to emit constructors as Wasm functions that push the receiver in their epilogue. If a future lowering moves the receiver creation out of the constructor body and into a wrapper, constructors would look like ordinary functions with `(params...) -> (ref $ClassType)` signature and no trailing trickery, and both checks could be removed. That is a bigger restructuring than this PR series wants to take on.

### Dead code after tail call kept in place

The trailing `RETURN` in `visitFunctionReturn` and the trailing `buildGetUnit` for Unit returning callees are unreachable after a `return_call` since the frame is gone. I tried suppressing both on the tail path and stdlib functions like `AbstractMutableList.clear` failed validation with stack underflow. The reason is that `generateAsStatement` still emits `drop` expecting the value on the IR stack. For correctness the trailing instructions are left in place. The optimized binary path (`wasm-opt`) appears to fold most of this out so the binary size impact is small in practice.

## Verification done

- `BinaryCodecTest.tail-call` round trips the Wasm tail call proposal spec test data through Kotlin's binary and text encoders against wabt.
- `wasmIrCheckForTailCalls.kt` asserts the expected `return_call` / `return_call_ref` emission for the static dispatch, when branch, Unit return, try catch exclusion, tailrec preservation, and mutual recursion patterns, and runs a depth 100k mutual recursion under V8 as an end to end check.
- Existing `Diagnostics.Functions.TailRecursion` and `Coroutines.FeatureIntersection.Tailrec` suites pass, confirming no regression in the `tailrec` lowering path.
- The broader `Functions` subset (top level, extension, big arity, invoke, local) passes, confirming no regression in general call dispatch.

## Benchmarks

Used `kotlinx-benchmark` 0.4.17 in a standalone gradle project that consumes the locally installed compiler from `feature/wasm-tail-calls/02-static-emit`. Engine is the Node.js binary shipped by the Kotlin/Wasm gradle plugin (V8). 3 warmups and 5 iterations per data point. Comparison `OFF` was produced by patching `BodyGenerator.isEligibleForTailCall` to return `false` and reinstalling.

Throughput in operations per second, higher is better. `ON / OFF` is the ratio.

| pattern | depth | OFF | ON | ON / OFF |
|--------|------:|----:|---:|---------:|
| static mutual recursion | 100 | 18,984,962 | 20,726,452 | 1.09 x |
| static mutual recursion | 1000 | 1,017,548 | 2,459,353 | 2.42 x |
| static mutual recursion | 10000 | 93,350 | 251,273 | 2.69 x |
| non `tailrec` self recursion | 100 | 12,652,513 | 21,338,094 | 1.69 x |
| non `tailrec` self recursion | 1000 | 530,233 | 2,254,782 | 4.25 x |
| non `tailrec` self recursion | 10000 | 52,658 | 223,615 | 4.25 x |
| `tailrec` lowered to a loop | 10000 | 269,675 | 268,931 | 1.00 x |
| virtual dispatch (PR 3 territory, unchanged) | 10000 | 60,946 | 60,433 | 0.99 x |
| interface dispatch (PR 3 territory, unchanged) | 10000 | 15,986 | 17,141 | 1.07 x |

1. Static dispatch tail calls scale up to about 2.7 x at depth 10000. The win grows with depth because deeper call chains amortize the frame swap saving over more invocations.
2. A self recursive function that the developer forgot to mark `tailrec` runs about 4.25 x faster once it gets the native tail call treatment.
3. `tailrec` lowered loops are at parity. The design choice to keep `tailrec` as a loop is confirmed.
4. Virtual and interface dispatch are unchanged at PR 2, confirming PR 2's scope is exactly the static dispatch path. PR 3 will move these numbers.

### Beyond the host stack limit

The numbers above stay within depths that V8 can handle in either configuration. The case the feature actually exists for is the one V8 cannot survive without it. To probe that directly I added a `DepthStress` benchmark class that calls each of the four patterns at depth 1,000,000, then ran the suite once with the feature enabled and once with `isEligibleForTailCall` patched back to `false`.

With the feature disabled the first benchmark method to run (`interfaceMutualAt1M`, alphabetical order) throws `RangeError: Maximum call stack size exceeded` and kills the Node process, taking the benchmark task down with it before any other `DepthStress` method runs. The repeated wasm offset in the stack trace is the recursive interface dispatch frame being pushed over and over until V8 gives up.

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

| pattern | throughput at depth 1M | per call cost |
|--------|--------------------:|------------:|
| static mutual recursion | 2,561 ops/sec | about 390 ns |
| non `tailrec` self recursion | 1,597 ops/sec | about 626 ns |
| virtual dispatch mutual | 1,067 ops/sec | about 937 ns |
| interface dispatch mutual | 251 ops/sec | about 3.98 μs |

Per call cost stays in the hundreds of nanoseconds to a few microseconds at this depth. Frame reuse means memory does not grow with depth, so a Kotlin/Wasm program is no longer bounded by the host stack limit, only by the runtime of the program itself.

## Process so far

Initial design exploration was bottom up. I read `TailrecLowering`, `BodyGenerator`, `Operators.kt`, and the `WasmLoweringPhases` ordering, then sketched the eligibility filter list against the failure modes (try catch exclusion, signature mismatch, intrinsic handling, constructor receiver issues). After that the work has been one PR at a time, each gated on local tests and a regression sweep.

There were two unexpected findings during the work.

1. The wabt 1.0.19 parser bug (WebAssembly/wabt#2018) blocks the spec test even after the opcode is added. The simplest fix is a localized text emitter workaround for `return_call_indirect`. I investigated upgrading wabt, but the upgrade chains into a testsuite revision bump that surfaces preexisting IR layer text emitter and parser bugs around reference types canonical forms. Some of those tests live in files that previously passed (`binary.wast` and `binary-leb128.wast` grew bulk memory binary edge cases), so skipping them would regress MVP coverage. Belongs as a separate effort coupled with an IR layer text emitter and parser refresh.

2. `BinaryenConfig.kt` did not pass `--enable-tail-call` to `wasm-opt`. Without that flag, any Kotlin/Wasm module containing `return_call` is rejected by binaryen with `unexpected false: return_call* requires tail calls`. Added the one line fix as a separate commit on PR 2. This is a hard requirement for the feature to work end to end.

## Follow ups and possible optimizations

WIP
