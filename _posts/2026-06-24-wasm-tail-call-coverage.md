---
layout: post
title: "Kotlin/Wasm Tail Calls: What We Can and Can't Optimize Today"
date: 2026-06-24
categories: [Technology, Compiler]
tags: [Kotlin, WebAssembly, Compiler, GSoC]
---

## What the tail call PR series covers

The [Kotlin/Wasm tail call PR series](https://ternbusty.github.io/posts/gsoc-wasm-tail-calls/) teaches the compiler to emit native Wasm tail call instructions (`return_call`, `return_call_ref`) for calls that sit in tail position. The Wasm spec guarantees that a tail call reuses the caller's stack frame, so any chain of tail calls runs in constant stack space regardless of depth.

Below are the call patterns the current implementation handles, the ones it does not, and what a survey of real codebases found about each.

## Patterns that are optimized

### Static dispatch (mutual recursion, non-tailrec self recursion)

Any direct function call in tail position emits `return_call` instead of `call`.

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

This is the pattern that `tailrec` cannot express. `tailrec` only rewrites direct self-recursion into a loop. Mutual recursion between `isEven` and `isOdd` would overflow at around depth 10K on V8 without tail calls. With tail calls enabled, it runs to depth 1M in constant stack space.

Self-recursion without the `tailrec` annotation is also covered.

```kotlin
fun sumTo(n: Int, acc: Int = 0): Int {
    if (n == 0) return acc
    return sumTo(n - 1, acc + n)  // emits return_call (self)
}
```

If the developer had written `tailrec fun sumTo(...)`, the existing `TailrecLowering` pass would have rewritten it into a `do-while` loop before codegen. The loop form is ~20% faster (no frame teardown overhead), so the compiler leaves `tailrec` functions alone and only emits native tail calls for unmarked functions.

### Virtual dispatch

Calling an `open` or `abstract` method in tail position emits `return_call_ref` via the vtable.

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

In a tree-walking interpreter, `eval` dispatches through the class hierarchy at every node. Without tail calls, evaluating a deeply nested AST (e.g. a chain of 10K `if` expressions) overflows the stack. With tail calls, whichever branch `If.eval` picks is a tail call, so the stack stays flat.

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

### Function references (callRef)

Calling a value of function type is an indirect call, even when it reads like a plain call.

```kotlin
fun applyTransform(value: Int, transform: (Int) -> Int): Int {
    return transform(value)  // indirect: the target is a runtime value
}

fun doubled(x: Int) = x * 2

fun main() {
    println(applyTransform(21, ::doubled))  // 42
}
```

When the value is a function reference like `::doubled` (not a lambda closure), the compiler generates a reference class whose `invoke` bridge dispatches through the `callRef` intrinsic, a typed `call_ref` on a funcref. PR 5 emits `return_call_ref` for that bridge when it sits in tail position, so reference-dispatched recursion runs in constant stack.

## Patterns not yet optimized

### Lambda dispatch

Lambda closures (`{ ... }`) go through `FunctionN<R>.invoke()`, and the compiler does not emit these as tail calls today, even when they sit in tail position.

```kotlin
fun runThen(n: Int, action: () -> Unit) {
    if (n == 0) return action()      // in tail position, but NOT emitted as a tail call
    return runThen(n - 1, action)    // emitted (static self-dispatch)
}
```

The `action()` sits in tail position, the same position where the self-call one line below gets `return_call`. It still compiles to a plain `action.invoke()`, because the invoke path hits two problems.

The first is an IR-level issue. `Function0<Unit>.invoke()` has erased return type `Any?` at the Wasm level. `GenericReturnTypeLowering` sees the mismatch between `Any?` (erased) and `Unit` (call site) and wraps the invoke in an implicit `as Unit` cast. `WasmTypeOperatorLowering` then expands this cast into a composite expression:

```
Composite {
    action.invoke()        // evaluated as a statement, discarded
    Unit.getInstance()     // the actual "result"
}
```

The cast expansion demotes `invoke()` to a statement, out of tail position.

The second is a Wasm-level signature mismatch. Even without the cast expansion, `Function0<Unit>.invoke()` returns `anyref` in the Wasm signature, while a Unit-returning caller has return type `void`. The Wasm spec requires `return_call_ref` signatures to match exactly, so the Wasm validator would reject the call.

Any code that passes callbacks through recursive structures hits this. A CPS (Continuation-Passing Style) transformation, for example, relies on lambda tail calls to run in constant stack.

```kotlin
// Cannot run in constant stack today: k.invoke() is never tail-called
fun buildTree(node: ASTNode, k: (Tree) -> Tree): Tree {
    if (node.isLeaf) return k(Tree.Leaf(node.value))
    return buildTree(node.left) { leftTree ->
        buildTree(node.right) { rightTree ->
            k(Tree.Branch(leftTree, rightTree))
        }
    }
}
```

I prototyped one fix, changing the Wasm calling convention so Unit-returning functions return `anyref` (the Unit singleton), which makes the signatures match. CPS-style code ran to depth 500K with the change, but it touches block expressions, try-finally, and the suspend state machines, and broke 128 existing tests, so it is not part of the PR series.

### Non-tail recursion (parser loops, tree traversals)

Some recursive patterns are structurally non-tail. The call is inside a loop body, or its result is consumed by an enclosing expression.

```kotlin
// Recursive descent parser: recursion is inside a while loop
fun parseObject(depth: Int): Node {
    val children = mutableListOf<Node>()
    while (hasMoreTokens()) {
        children.add(parseObject(depth + 1))  // not in tail position
    }
    return Node(children)
}
```

```kotlin
// Tree traversal: recursion result is consumed by +
fun treeSum(node: TreeNode): Int {
    if (node.isLeaf) return node.value
    return treeSum(node.left) + treeSum(node.right)  // neither call is in tail position
}
```

No amount of `return_call` emission helps here because the calls are not in tail position to begin with. Optimizing these would require a source-level transformation (CPS conversion for the parser, or accumulator introduction for the tree sum) before codegen.

Apollo's GraphQL parser ships this exact shape today, in [`parseValueInternal`](https://github.com/apollographql/apollo-kotlin/blob/main/libraries/apollo-ast/src/commonMain/kotlin/com/apollographql/apollo/ast/internal/Parser.kt#L989).

```kotlin
private fun parseValueInternal(const: Boolean): GQLValue {
  return when (val t = token) {
    is Token.LeftBracket -> parseList(const)
    is Token.LeftBrace -> parseObject(const)
    // ...
  }
}

private fun parseObject(const: Boolean): GQLObjectValue {
  return GQLObjectValue(
      sourceLocation = sourceLocation(),
      fields = parseList<Token.LeftBrace, Token.RightBrace, GQLObjectField> {
        parseObjectField(const)  // which parses a value, re-entering parseValueInternal
      }
  )
}
```

The `GQLObjectValue` constructor consumes the result, so the call is not a tail call, and the recursion re-enters through a lambda inside a list-builder loop. In my probe this parser overflows around nesting depth 2,000.

## How real codebases avoid recursion in the first place

I surveyed 15 Kotlin multiplatform libraries for recursion shapes (constructor-wrap patterns plus Tarjan SCC analysis of per-file call graphs, every hit verified by hand). The first finding is that libraries parsing deeply nested input have mostly engineered their recursion away, each with a different escape hatch.

JetBrains/markdown parses block structure with no recursion at all. The parser core, [`MarkerProcessor`](https://github.com/JetBrains/markdown/blob/master/src/commonMain/kotlin/org/intellij/markdown/parser/MarkerProcessor.kt#L15), maintains an explicit stack of open blocks and pushes and pops it in a flat scan loop.

```kotlin
abstract class MarkerProcessor<T : MarkerProcessor.StateInfo>(/* ... */) {
    protected val markersStack: MutableList<MarkerBlock> = ArrayList()
    // markersStack.add(newMarkerBlock) / closeChildren(index, ...) in a flat scan loop
```

The kudzu parser combinator library kept the recursion but moved it to the heap, making every parser a `DeepRecursiveFunction` [by declaration](https://github.com/copper-leaf/kudzu/blob/main/kudzu-core/src/commonMain/kotlin/com/copperleaf/kudzu/parser/ParseFunction.kt).

```kotlin
public typealias ParseFunction<T> = DeepRecursiveFunction<ParserContext, ParserResult<T>>

public interface Parser<NodeType : Node> {
    public fun predict(input: ParserContext): Boolean
    public val parse: ParseFunction<NodeType>
}
```

The [KDoc on `Parser`](https://github.com/copper-leaf/kudzu/blob/main/kudzu-core/src/commonMain/kotlin/com/copperleaf/kudzu/parser/Parser.kt) spells the motivation out: parsing "is implemented with Kotlin's DeepRecursiveFunction, which uses suspend functions to convert a recursive function into an iterative one, where the recursion is managed on the heap rather than on the call-stack".

Some code copes by crashing. Apollo's parser above overflows on deep input, and the stdlib regex matcher recurses per input character with an open production crash report ([KT-63689](https://youtrack.jetbrains.com/issue/KT-63689)).

Library authors have removed most of the recursion an optimizer would like to find. The remainder splits into code that pays a runtime cost for the manual rewrite (kudzu's `DeepRecursiveFunction` runs 8 to 15 times slower than native recursion on wasmJs) and code that still crashes.

## Constructor-wrapped recursion in the survey

The survey also looked for constructor-wrapped recursion, the shape where exactly one constructor consumes the recursive call's result and nothing else runs after the call. OCaml 4.14's tail-modulo-cons optimizes this shape, and the [TMC post](https://ternbusty.github.io/posts/wasm-tmc-selective-tail-calls/) covers the transform itself.

```kotlin
class Node(val value: Int, val next: Node?)

fun copyList(n: Node?): Node? {
    if (n == null) return null
    return Node(n.value, copyList(n.next))  // tail modulo cons
}
```

The survey found zero self-recursive instances across the 15 libraries. Kotlin developers build lists with `MutableList` and imperative loops rather than functional constructor-chaining like `Node(x, recurse(...))`.

The shape does exist in one form, as mutual-recursion cycles. The clearest specimen is square/wire's protobuf option parser, [`OptionReader.readKindAndValue`](https://github.com/square/wire/blob/master/wire-schema/src/commonMain/kotlin/com/squareup/wire/schema/internal/parser/OptionReader.kt#L96).

```kotlin
private fun readKindAndValue(): KindAndValue {
  when (val peeked = reader.peekChar()) {
    '{' -> return KindAndValue(MAP, readMap('{', '}', ':'))
    '[' -> return KindAndValue(LIST, readList())
    // ...
  }
}

private fun readList(): List<Any> {
  // ...
  while (true) {
    // ...
    val option = readKindAndValue()  // closes the cycle
    // ...
  }
}
```

The recursive result is wrapped in exactly one `KindAndValue` constructor, which is textbook TMC, but the recursion closes through `readMap` and `readList`, so it is a mutual cycle rather than self-recursion. xmlutil's XPath parser (an 11-function cycle in [`XPathExpression.kt`](https://github.com/pdvrieze/xmlutil/blob/master/xmlschema/src/commonMain/kotlin/io/github/pdvrieze/formats/xpath/XPathExpression.kt)) and Keval's expression grammar ([`Grammar.kt`](https://github.com/notKamui/Keval/blob/main/src/commonMain/kotlin/com/notkamui/keval/Grammar.kt)) have the same structure with wider cycles.

The most consequential instance ships inside Kotlin itself. The Kotlin/Wasm stdlib regex pattern compiler, [`Pattern.kt`](https://github.com/JetBrains/kotlin/blob/master/libraries/stdlib/native-wasm/src/kotlin/text/regex/Pattern.kt#L339), builds its automaton with a `processExpression`/`processSubExpression` cycle whose result lands in a field write.

```kotlin
val next = processSubExpression(last)
// ...
cur.next = next   // tail modulo a field write, not a constructor
// ...
return cur
```

Compiling `Regex("(".repeat(2000) + "a" + ")".repeat(2000))` overflows the stack today because of this cycle.
