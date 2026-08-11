---
layout: post
title: "Kotlin/Wasm: Accumulator Recursion Lowering"
date: 2026-08-11
categories: [Technology, Compiler]
tags: [Kotlin, WebAssembly, Compiler, GSoC]
---

## The pattern

Some recursive functions wrap their self-call in an associative operator.

```kotlin
fun countDown(n: Int): Int {
    if (n == 0) return 0
    return 1 + countDown(n - 1)
}
```

`countDown(n - 1)` is not in tail position because `1 +` wraps the result. `-Xwasm-enable-tail-calls` cannot help, and `tailrec` rejects this shape. On V8, the function overflows around depth 10,000.

[PR #16](https://github.com/ternbusty/kotlin/pull/16) adds [`WasmAccumulatorRecursionLowering`](https://github.com/ternbusty/kotlin/compare/feature/wasm-tail-calls/main...feature/wasm-tail-calls/accum-lowering), which rewrites this into accumulator-passing form so the self-call lands in tail position.

## The transform

The compiler generates a private `$accum` helper that threads the pending operand as an extra parameter.

```kotlin
// Original
fun countDown(n: Int): Int {
    if (n == 0) return 0
    return 1 + countDown(n - 1)
}

// Generated helper
private fun countDown$accum(n: Int, acc: Int): Int {
    if (n == 0) return acc + 0     // base case folds the accumulator in
    return countDown$accum(n - 1, acc + 1)  // tail position
}

// Original is rewritten to delegate
fun countDown(n: Int): Int = countDown$accum(n - 1, 1)
```

The self-call in `countDown$accum` sits in tail position, so [`WasmTailCallLowering`](https://github.com/JetBrains/kotlin/blob/master/compiler/ir/backend.wasm/src/org/jetbrains/kotlin/backend/wasm/lower/WasmTailCallLowering.kt) emits `return_call`. After the transform, `countDown(1_000_000)` runs in constant stack.

## Supported operators

The lowering targets two categories.

Commutative operators on `Int` and `Long` require only one accumulator because `a ⊕ b = b ⊕ a`. The operand can appear on either side of the recursive call.

| Operator | Type | Example |
|---|---|---|
| `+` | Int, Long | `return n + sumTo(n - 1)` |
| `*` | Int, Long | `return n * factorial(n - 1)` |
| `and` | Int, Long | `return maskChain(n - 1, bit) and bit` |
| `or` | Int, Long | `return maskChain(n - 1, bit) or bit` |
| `xor` | Int, Long | `return xorChain(n - 1, bit) xor bit` |

`String.plus` is associative but not commutative. The lowering handles it for one-sided patterns by preserving operand order.

```kotlin
fun repeatStr(s: String, n: Int): String {
    if (n == 0) return ""
    return s + repeatStr(s, n - 1)  // right-recursive: operand on the left
}
```

The generated helper accumulates from the left, building `(((seed + s) + s) + s)`, which produces the same result as `s + (s + (s + seed))` because `String.plus` is associative.

```kotlin
private fun repeatStr$accum(s: String, n: Int, acc: String): String {
    if (n == 0) return acc + ""
    return repeatStr$accum(s, n - 1, acc + s)
}
```

## Performance

[`kotlinx-benchmark`](https://github.com/kotlin/kotlinx-benchmark) 0.4.17 in a [standalone project](https://github.com/ternbusty/wasm-tail-call-bench), Kotlin 2.5.255-SNAPSHOT, Node.js v24.12.0 (V8 13.6). 5 warmups, 10 iterations, 1 second each. [`AccumulatorIntro.kt`](https://github.com/ternbusty/wasm-tail-call-bench/blob/main/src/wasmJsMain/kotlin/bench/AccumulatorIntro.kt) measures three accumulator patterns at three depths.

Throughput in operations per second, higher is better. `ON / OFF` is the ratio.

| pattern | depth | OFF | ON | ON / OFF |
|---------|------:|----:|---:|---------:|
| Int addition | 100 | 12,292,124 | 25,305,993 | 2.06 x |
| Int addition | 1,000 | 571,306 | 2,801,226 | 4.90 x |
| Int addition | 10,000 | 47,150 | 253,001 | 5.37 x |
| Int multiplication | 100 | 7,732,476 | 8,709,136 | 1.13 x |
| Int multiplication | 1,000 | 563,647 | 964,255 | 1.71 x |
| Int multiplication | 10,000 | 54,915 | 102,386 | 1.86 x |
| String concatenation | 100 | 997,204 | 1,103,108 | 1.11 x |
| String concatenation | 1,000 | 90,058 | 106,330 | 1.18 x |
| String concatenation | 10,000 | 5,426 | 5,767 | 1.06 x |

![Accumulator lowering per-call cost at depth 10,000](/assets/img/2026-06-24-accum-chart.svg)

- Int addition shows the largest gain at 5.37x because the per-step cost is dominated by the recursion overhead that the lowering eliminates. Multiplication follows the same trend at 1.86x.
- String concatenation shows only 1.06x at depth 10,000 because the `String.plus` allocation dominates per-step cost, making the recursion overhead a negligible fraction.
- All three patterns survive depth 1,000,000 with the lowering enabled. Without it, they overflow the V8 Wasm stack around depth 14,000.
