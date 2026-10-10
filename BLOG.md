# ORION — From a Mandelbrot Set to a Compiler You Can Look Inside

*Article draft · October 2026*

On January 2, I posted a Mandelbrot set and a small compiler I had built in TypeScript. It was the first day of being 19, and I wanted to ship something.

The language was called ASTRA. The compiler was ORION. The image was the result of compiling an ASTRA program into a WebAssembly module and running it.

That last part was the reason I cared about the project. The compiler produced the binary itself: sections, function bodies, instructions, and their encoded operands. There was no generated JavaScript or WebAssembly text sitting between the program and the bytes.

Nine months later, the most useful question is less “can it draw a fractal?” and more “can I explain exactly how it got there?”

The new playground is my answer. You can run a program, open the Lab, and follow it through tokens, its lowered syntax tree, generated instructions, and the final bytes. Select an instruction and it highlights its encoding in the module.

[Source: vennictus/orion](https://github.com/vennictus/orion)

## Start with five

This is a complete ASTRA program:

```astra
print (2 + 3)
```

The tokenizer identifies `print`, the parentheses, two numbers, and an addition operator. Each token keeps its line and column so the parser can point back to the source.

The parser turns that sequence into a print statement containing a binary expression. Parentheses establish the expression boundary; precedence determines which operations belong together. It checks the grammar here rather than hoping the WebAssembly engine will reject a bad result later.

The emitter walks the expression and places values on WebAssembly's operand stack. Conceptually, the interesting part is:

```text
f32.const 2
f32.const 3
f32.add
call print_f32
```

The first two instructions push values. Addition pops two operands and pushes one result. The imported print function consumes that result and hands it to the host.

`f32.add` is encoded as `92` in hexadecimal. That is an actual byte in the emitted module. The Lab shows the instruction's absolute offset, and clicking it takes you to that byte.

It is a small interaction, but it connects three things that are easy to learn separately: an expression in a language, a stack operation in a machine model, and a byte in a file.

## A module is more than instructions

An instruction stream is only one part of a valid WebAssembly module.

ORION writes the header and sections describing function signatures, imports, defined functions, memory, exports, and code. The host supplies integer and floating-point printing. The compiled program exports a `run` function and linear memory.

The module has to agree with itself. A call instruction contains a function index. That index must refer to a function with the right signature. A function body declares locals, and every local access has to use the right index and type. Section lengths and body lengths must describe the bytes that follow them.

Integer fields generally use LEB128, which stores small values compactly and uses continuation bits for larger ones. Floating-point constants use their binary representation. Getting arithmetic right while getting one length wrong still gives you an invalid module.

There is no general optimizer or intermediate representation pipeline. ORION lowers the AST directly into binary instructions. That keeps the route short enough to inspect, while making the emitter responsible for type conversions, scopes, control flow, and temporary locals.

## The awkward part is often control flow

ASTRA has `if`, `while`, half-open `for` ranges, `break`, and `continue`. It also has functions and recursion.

WebAssembly control flow is structured. Branches target enclosing blocks by depth. They are not jumps to arbitrary source labels.

Here is a case that exposed a real compiler bug:

```astra
for i in 0..4
  if (i == 1)
    continue
  end
  print i
end
```

The expected output is `0`, `2`, `3`.

One tempting lowering turns a `for` into a `while` and appends the increment to the body. But if `continue` branches straight to the condition, it skips that increment. When `i` reaches one, the program can stay there forever.

The current lowering gives the body a separate block. Continuing exits that body block, reaches the increment, and then checks the condition again. Breaking exits the loop. Nested loops have their own targets.

There is another detail: a variable declared inside the body can shadow the loop variable. The generated update still needs to modify the induction variable from the outer scope. The body scope therefore closes before the update is emitted.

A picture of a fractal will never tell you whether this works. A small regression case will.

## Types need a policy

ASTRA is numeric and intentionally small. Mutable variables and function parameters use `f32`. Integer values also appear during expression emission, and the compiler converts them when an operation or call requires it. Function results use `f32`; falling through a function returns zero.

Those choices have consequences. Floating-point arithmetic rounds. An `f32` cannot represent every large integer exactly. Invalid conversions can trap, and arithmetic can produce non-finite results. This is a language with explicit limits.

Conditions treat zero as false and nonzero as true. Logical operators normalize their operands to boolean values. They currently evaluate both operands; they do not short circuit. That behavior matters when a function call has a visible effect, so it belongs in the documentation and the tests.

The audit caught places where policy and implementation had drifted apart: incomplete constructs accepted at end of input, unchecked call arity, duplicate declarations, inconsistent truthiness, and a function fallback that could be mistaken for the wrong instruction. Each now has a regression case.

The point was to turn “this example runs” into a more specific set of claims about the language.

## The Mandelbrot set is memory

Graphics use the same mechanism as the rest of the language: emitted WebAssembly instructions.

```astra
setpixelrgb 0 0 10 20 30
```

This writes one pixel into exported linear memory. Pixels occupy four consecutive bytes in RGBA order. At coordinate `(x, y)`, the byte address is:

```text
(y * width + x) * 4
```

The host copies that memory into an `ImageData` buffer and displays it on a canvas. The rendering math runs in WebAssembly; the browser presents the result.

Pixel operands are evaluated once, from left to right. Coordinates outside the canvas are ignored. Color channels use their low eight bits, and a written pixel gets alpha 255. Canvas dimensions belong to each compilation, rather than mutable global state another compilation can overwrite.

The default Mandelbrot example makes the result visible immediately. Other examples include Julia sets, the Burning Ship, a Sierpinski triangle, and simpler gradients and patterns. They exercise enough arithmetic and loops to be interesting, but they remain examples rather than a completeness proof.

## Running someone else's loop

An interactive compiler has a host problem as well as a compiler problem:

```astra
while (1)
end
```

If that runs synchronously on the browser's main thread, the Stop button cannot help. Its click handler needs the same thread the loop is occupying.

The playground now compiles and executes in a disposable worker. The interface can terminate that worker. A run also has an eight-second deadline, and printed output is capped at 1,000 lines. Loading shared source compiles it for inspection without automatically executing it.

Those protections belong to the playground. The low-level runtime is synchronous and does not acquire a deadline just because its caller uses an async function. Another application embedding the runtime must provide its own isolation.

The timing panel separates compiler work, WebAssembly validation, and execution. These are measurements of one run in the current browser, not a benchmark against other compilers.

## Make the intermediate work visible

The Lab has four views:

- **Tokens:** lexical values and source positions, with selection back into the editor.
- **AST:** the tree the compiler actually consumes, including lowered `for` loops.
- **Instructions:** decoded from the emitted module, grouped by function and labeled with byte offsets.
- **Bytes:** section boundaries and hexadecimal data, with the selected instruction's encoding highlighted.

The instruction view decodes the binary produced by the compiler. It does not reconstruct what the AST ought to have produced. That distinction makes it useful when the emitter is wrong.

The decoder supports ORION's emitted instruction subset. It is not a general WebAssembly disassembler. The browser also limits how many rows it renders, while allowing the full module to be downloaded.

Three short guided examples connect the views: arithmetic, branching and loops, and recursive factorial. The aim is to make a small program explainable without turning the playground into a debugger.

## What I would claim about it

ORION holds its own as a focused, inspectable compiler project. It emits real WebAssembly binaries, supports meaningful control flow and recursion, renders through linear memory, and now has regression coverage for the failures found in its audit.

It does not have arrays, strings, closures, a general heap, optimization passes, or the breadth of a production language implementation. Being written in TypeScript says little about its quality by itself. The more useful questions are whether the language's behavior is defined, whether the compiler implements that behavior, and whether someone else can inspect the result.

The original post answered one question: can I make this pipeline run?

The current version makes it much easier to ask where every part of that pipeline goes.

## The Rust version comes next

I plan to port ORION to Rust. Before changing the implementation language, I want a stable description of what programs mean.

The repository now includes portable conformance fixtures: source programs with expected output, expected pixel bytes, or expected errors. A second implementation can run the same fixtures. It does not have to emit byte-for-byte identical modules to preserve observable behavior.

Rust will change how the compiler represents ownership and state. Whether it improves performance is something to measure after the port exists.

For now, this version gives the next one something concrete to agree with—and gives a reader a way to follow `print (2 + 3)` all the way down to `92`.
