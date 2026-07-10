---
layout: post
title: "Stackless Recursion for Kotlin/Wasm: Fixing a Production Regex Crash and a 15x DeepRecursiveFunction Tax"
date: 2026-07-03
categories: [Technology, Compiler]
tags: [Kotlin, WebAssembly, Compiler, GSoC]
---

## The premise

The [TMC post](https://ternbusty.github.io/posts/wasm-tmc-selective-tail-calls/) closed on the finding that real-world Kotlin contains little optimizable recursion, because deep recursion has burned library authors before and they engineered it away by hand. That leaves two groups paying today.

1. Code that could not afford the rewrite still crashes. The stdlib regex matcher recurses per input character for backtracking patterns, and [KT-63689](https://youtrack.jetbrains.com/issue/KT-63689) is an open report of an iOS app crashing in production on roughly 800 input characters of `"(?:\\,|[^,])+".toRegex().findAll(query)`. KT-61542 and KT-78089 are the same engine. The JetBrains comment on KT-63689 says a proper fix needs a recursion-free regex engine and is not straightforward. To see why no tail-call emission can help, here is the actual overload that KT-63689's pattern dies in, [`NonCapturingJointSet.matches`](https://github.com/JetBrains/kotlin/blob/master/libraries/stdlib/native-wasm/src/kotlin/text/regex/sets/NonCapturingJointSet.kt) in the stdlib.

   ```kotlin
   override fun matches(startIndex: Int, testString: CharSequence, matchResult: MatchResultImpl): Int {
       val start = matchResult.getConsumed(groupIndex)
       matchResult.setConsumed(groupIndex, startIndex)

       forEachChildIndexed { _, child ->
           val shift = child.matches(startIndex, testString, matchResult)  // virtual, mutual
           if (shift >= 0) return shift
       }

       matchResult.setConsumed(groupIndex, start)  // backtrack on failure
       return -1
   }
   ```

   The recursive call's result is inspected to decide between accepting and backtracking, and the consumed-position state must be restored after a failed attempt. Both of those happen after the call returns, so the call is structurally not in tail position, ever. It is also a virtual call on `AbstractSet` with 38 overrides, one frame or more per input character on alternation patterns like the one in the crash report.
2. Code that did the rewrite via `DeepRecursiveFunction` (the stdlib's official deep-recursion idiom) runs the coroutine machinery on every `callRecursive`. Measured on wasmJs, that is 8 to 15 times slower than native recursion, with superlinear degradation at depth (a probe at 1M list nodes took 99 times longer than a handwritten loop). kotlinx.serialization's JSON parser is the canonical user. [`JsonTreeReader`](https://github.com/Kotlin/kotlinx.serialization/blob/master/formats/json/commonMain/src/kotlinx/serialization/json/internal/JsonTreeReader.kt) parses the first 200 nesting levels with plain recursion and then switches.

   ```kotlin
   val result = if (++stackDepth == 200) {
       readDeepRecursive()  // heap-based, slow, unbounded
   } else {
       readObject()         // native recursion, fast, overflows if unbounded
   }
   --stackDepth

   private fun readDeepRecursive(): JsonElement = DeepRecursiveFunction<Unit, JsonElement> {
       when (lexer.peekNextToken()) {
           TC_STRING -> readValue(isString = true)
           TC_BEGIN_OBJ -> readObject()  // suspend variant, callRecursive inside
           TC_BEGIN_LIST -> readArray()
           // ...
       }
   }.invoke(Unit)
   ```

There is also no engine-side rescue coming soon. I verified on d8 that growable stacks do not raise the recursion limit, that the stack guard is not configurable in browsers, and that a stack overflow cannot be caught inside wasm.

The plan is a compiler lowering that produces the recursion-free version mechanically from the existing code. It landed as a three-PR stack: the shared body planner ([PR 9](https://github.com/ternbusty/kotlin/pull/9), no compiler phase of its own), DeepRecursiveFunction acceleration behind `-Xwasm-enable-drf-acceleration` ([PR 10](https://github.com/ternbusty/kotlin/pull/10)), and the matcher lowering behind `-Xwasm-enable-stackless-recursion` ([PR 11](https://github.com/ternbusty/kotlin/pull/11)), where targets are selected by a new `@kotlin.internal.StacklessRecursion` annotation on the abstract base method (the stdlib annotates `AbstractSet.matches`).

## The machinery

The lowering compiles a recursive region into a stackless state machine with typed heap frames. Heap-allocated frames are the one stack representation from [Farvardin and Reppy's six-way comparison of stack implementations (PLDI 2020)](https://doi.org/10.1145/3385412.3385994) that user code can build on a platform where the native stack can neither move nor grow, so the comparison made the choice for me. The remaining work was the constant factor.

1. A block planner splits each body at recursive call sites. A call in tail position becomes a receiver swap. A non-tail call saves the live locals into a frame struct with typed slots (no boxing for Int, Boolean, Char, Long, Float, Double) and records a resume state.
2. All planned bodies feed a single trampoline, a `while` loop over a state switch. Calls become jumps to the loop head with a pushed frame, and returns pop a frame and jump to its resume state. Host stack usage is constant regardless of depth.
3. Anything the planner cannot express bails out to the untouched native method, so partial coverage never changes semantics.

Two applications share this machinery.

### Virtual mutual recursion (the regex matcher)

Class hierarchy analysis enumerates every override of the target virtual method, each override gets a plan, and dispatch inside the trampoline is an instanceof chain ordered by inheritance depth. All 38 overrides of `AbstractSet.matches` in the stdlib plan successfully, including bodies with inlined `forEach` remnants, local functions, and loops with breaks across the split points. Backtracking semantics survive because a heap frame is a 1 to 1 replacement for the native stack frame, including the enter-counter save and restore.

### DeepRecursiveFunction literals

Property-held and direct-invoke `DeepRecursiveFunction { ... }` literals are detected, free-variable captures become leading parameters, private suspend helpers are inlined, and an ANF pre-pass hoists `callRecursive` out of argument positions so shapes like `n.value + callRecursive(n.next)` and `maxOf(callRecursive(t.left), callRecursive(t.right))` plan cleanly. Invoke sites are rewritten to a synthesized native twin. The coroutine machinery disappears from the path entirely. Literals with mutable captures, foreign suspend calls, or mutual DRF references bail out and keep stock behavior.

### The hybrid depth threshold

Full replacement made shallow calls slower, so bodies stay native below a module-level depth counter threshold of 512. A call site that crosses the threshold delegates its whole subtree to the trampoline once and receives the result as a plain value, so there is no unwinding protocol. Shallow everyday patterns keep native performance, and only deep inputs pay for heap frames.

The trick comes from [Chez Scheme's segmented stack (Hieb, Dybvig and Bruggeman, PLDI 1990)](https://doi.org/10.1145/93548.93554), whose overflow check I reuse with a depth counter standing in for the segment boundary, three decades of production validation included. I shaped the details around two known failure modes. Go abandoned segmented stacks in 1.3 because of the hot-split problem, where a loop crossing a segment boundary pays the boundary cost on every iteration, which is why crossing my threshold delegates the whole subtree once instead of linking per frame. The reactive alternative of running natively until overflow and then evacuating, [Baker's "Cheney on the M.T.A." (1995)](https://doi.org/10.1145/214448.214454), is unavailable because the d8 experiments showed wasm cannot catch its own stack overflow, so the counter has to be proactive.

## Results: the crash side

With the flag on and the stdlib recompiled but unmodified, the open crash reproductions pass.

| Issue | Pattern | Before | After |
|---|---|---|---|
| KT-63689 | `(?:\\,\|[^,])+` findAll | overflow at 2,000 chars | runs at 50,000 chars |
| KT-78089 | deep link `(.)*` matchEntire | overflow | runs at 20,000-char query |
| KT-46211 shape | `[a]+` replace on 10,000 chars | overflow on K/N | runs |

A 33-case correctness smoke (groups, alternation, lookahead, lookbehind, backreferences, replace, split, case-insensitive matching, quantifiers) passes on the transformed stdlib. Shallow patterns cost at most 5 percent versus the pass disabled, measured with frozen binaries from identical source, interleaved runs (synthetic microbench).

## Results: the DeepRecursiveFunction side

All numbers below use the same discipline. Both configurations are built from identical source, the binaries are frozen, and runs are interleaved, 3 runs, medians in us/op. Earlier in the project I got burned by cross-build comparisons, which carry systematic error of the same magnitude as some real effects, so I re-measured every table here this way.

Synthetic microbenchmarks first.

| Workload | flag off (stock DRF) | flag on | ratio |
|---|---:|---:|---|
| list-sum, 100 nodes | 4.05 | 0.272 | 14.9x |
| list-sum, 10,000 nodes | 453.9 | 74.9 | 6.1x |
| tree-depth, 64K nodes | 6,666 | 352.8 | 18.9x |
| deep-list-sum, 1M nodes | 271,300 | 72,936 | 3.7x |
| deep-spine-depth, 100K | 30,329 | 2,188 | 13.9x |
| tree-reader shape, 100K | 74,614 | 35,626 | 2.1x |

The real-project check uses kotlinx.serialization as published on Maven, no source changes, parsing deeply nested JSON via `parseToJsonElement`. Its `JsonTreeReader` switches to `DeepRecursiveFunction` past nesting depth 200, and the lowering picks that literal up from the klib (direct-invoke form, six free captures, one inlined suspend helper).

| Nesting depth | flag off | flag on | ratio |
|---:|---:|---:|---|
| 500 | 108.2 | 76.8 | 1.41x |
| 2,000 | 497.7 | 319.5 | 1.56x |
| 10,000 | 3,717 | 1,599 | 2.32x |
| 50,000 | 48,222 | 44,767 | 1.08x |

Depth 500 has only a short DRF region (the first 200 levels use plain recursion), so the gain is the coroutine removal alone. The depth 50,000 ratio turned out to be engine-dependent. On V8 15.1 the transformed path runs the same workload in 8.9 ms against 44.7 ms stock, a 5.0x gap, so the newer the engine, the better this looks.

The real-project run caught one last bug. The lexer returns `Byte`, my typed-slot default-value helper did not cover `Byte`, and the fallback null constant trapped at the trampoline entry with a null-pointer dereference. Synthetic benches only used `Int`, and the trampoline only runs past depth 512, so nothing shallower could have caught it. The box test now bakes in that shape.

## "Just wait for stack switching?"

A fair objection is that the Wasm stack-switching proposal, whose design comes from [WasmFX (Phipps-Costin et al., OOPSLA 2023)](https://arxiv.org/abs/2308.08347), will eventually make coroutines cheap, dissolving the DRF overhead without any of this machinery. That is testable today, since the Kotlin compiler already has `-Xwasm-use-stack-switching-proposal`. Three configurations, same real serialization benchmark, interleaved on the same d8 build (V8 15.1.0), medians in us/op.

| Depth | lowering on | stock DRF | stock DRF + stack switching |
|---:|---:|---:|---:|
| 500 | 82.9 | 94.5 | 1,932 |
| 2,000 | 320.9 | 461.9 | 12,248 |
| 10,000 | 1,854 | 2,511 | 72,387 |
| 50,000 | 8,869 | 44,696 | crash (RangeError) |

Today's stack-switching path is 20 to 29 times slower than plain stock DRF, and at depth 50,000 it overflows the host stack inside `CoroutineImplStackSwitching.resumeWith`, losing the unbounded-depth property that is DRF's whole point. Node 26 cannot even compile the module (a V8 CHECK failure in the optimizing compiler). The implementation will improve, but one `callRecursive` per stack switch has a structural floor that a loop iteration does not. The long-term winner is more likely a design that switches once per deep region onto a growable stack, and that needs both a mature proposal and a Kotlin runtime redesign. Until then, this lowering covers the gap.

## Status and limitations

The work is prepared as a stacked series of draft PRs. [PR 9](https://github.com/ternbusty/kotlin/pull/9) carries the shared body planner and registers no phase, so it changes nothing on its own. [PR 10](https://github.com/ternbusty/kotlin/pull/10) carries the DRF acceleration with its flag and a box test that exercises the list-sum, tree-depth, and capture-heavy tree-reader shapes past the hybrid threshold. [PR 11](https://github.com/ternbusty/kotlin/pull/11) carries the matcher lowering, the stdlib annotation, and a box test that drives the real stdlib matcher 20,000 characters deep through the annotation path, so the test fails with a stack overflow if the transform silently stops firing.

Known limitations, also stated in the PRs.

1. An exception unwinding through an instrumented call site leaks one depth-counter increment. Harmless for the matcher, which does not throw on the match path, but a general version wants try/finally.
2. `find`, `findBack`, and `tryToMatch` are not transformed yet.
3. The regex compile-side crash (nested groups around depth 2,000, the `processExpression` cycle from the TMC post) is out of scope here and remains the flagship case for a mutual-SCC TMC extension.

