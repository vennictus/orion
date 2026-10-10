# ORION implementation guide

This guide describes the current TypeScript implementation. The fastest way to
follow it is to open the playground and choose **An expression becomes bytes**.
Keep the source visible while stepping through the Lab.

## 1. Start with one observable result

```astra
print (2 + 3)
```

The desired result is one printed number, 5. The implementation must turn this
source into a valid module whose run function invokes a host print import.

The public API in `src/compiler.ts` composes three operations:

```ts
const tokens = tokenize(source);
const ast = parse(tokens);
const wasm = emitter(ast, { width: 100, height: 100 });
```

The compiler emits bytes. WebAssembly.compile validates and compiles those bytes;
WebAssembly.instantiate binds the host imports. Calling the exported run function
executes the program. These are distinct operations, and the playground measures
the compiler, engine validation/compilation, and execution separately.

## 2. Recognize tokens without losing their source

The example produces six retained tokens: print, (, 2, +, 3, ). Whitespace and
comments are discarded. Every retained token records its one-based line and column.
The Lab uses those positions to select the corresponding source text.

Matchers are prioritized. Comments precede division. Longer overlapping comparison
operators precede their prefixes. Keywords have identifier boundaries, so `letter`
is an identifier. Numeric tokens are converted to JavaScript numbers; therefore
`5` and `5.0` have the same value and initial emission path.

Unexpected characters fail with a location. Numeric literals outside finite f32
range are rejected when parsed.

## 3. Build a tree with explicit grammar

The print statement owns a binary expression with two number-literal children.
Parsing separates program structure from textual spelling. The emitter does not
scan strings or infer precedence.

ASTRA deliberately requires parenthesized binary expressions, such as `(2 + 3)`
and `((2 + 3) * 4)`. Additional grouping, such as `(x)`, is supported. Conditions
also have surrounding parentheses. Blocks close with `end`, or `}` for an explicit
scope. EOF cannot silently satisfy a required delimiter.

Function arguments and parameters are comma-separated without trailing commas.
Calls require the opening parenthesis immediately after the function identifier on
the same line. This disambiguates a variable operand followed by a separate
parenthesized operand in commands such as setpixel.

## 4. Lower syntax while preserving behavior

`for i in start..limit` becomes a block containing a declaration and while node.
The while node has a separate update list for `i = (i + 1)`.

That separation matters. Appending the increment to an ordinary while body is
incorrect: continue jumps to the condition and skips the increment. ORION emits a
block around the for body and makes it the continue target. Exiting that block
reaches the update. Breaking still exits the surrounding loop.

The condition reevaluates limit on each iteration. For ranges are ascending,
exclusive at the upper bound, and step by one. Body-local shadowing is allowed,
but cannot alter the binding used by the generated increment.

Choose **Where does continue go?** to inspect this lowering and check the output
`0, 2, 10, 12`.

## 5. Resolve names into local indices

Scopes are a stack of maps. A declaration allocates a local slot and records its
index. A read searches outward from the innermost map. Assignment resolves an
existing binding. Nested shadowing creates a distinct slot; same-scope duplicates
are errors. Slots are not reclaimed when a scope closes.

Variables are f32 locals regardless of their initializer. This permits later
fractional assignments to an initially integral variable. Parameters are also f32
and occupy the first local indices. Generated pixel temporaries use i32 locals.
Functions cannot capture variables from run.

## 6. Respect the WebAssembly stack

WebAssembly instructions consume and produce typed stack values. ORION emits
expression children before their parent operation.

For the example, the executable sequence is:

```text
i32.const 2          41 02
f32.convert_i32_s    b2
i32.const 3          41 03
f32.convert_i32_s    b2
f32.add              92
call 0               10 00
end                  0b
```

Each conversion ensures f32.add receives f32 operands. The addition leaves one f32
value. call 0 consumes it through env.print_f32, whose return type is void. The
run function then has no leftover values.

Click f32.add in the Lab. Its byte, 92, is highlighted at its actual module offset.
Offsets vary when imports, function signatures, locals, or preceding code change;
the decoder reads them rather than assuming a fixed layout.

Signed-i32-range integral literals use i32.const. Larger finite literals use
f32.const, avoiding silent 32-bit wrap. Variables, arithmetic, parameters, and
function results retain f32 rounding. Comparison and logical results are i32 0/1.
Both integer and float numeric conditions normalize zero/nonzero truthiness.
Logical AND/OR evaluate both sides; they do not short circuit.

## 7. Assemble an executable module

The module begins with magic bytes `00 61 73 6d` and version `01 00 00 00`.
Type, import, function, memory, export, and code sections follow. Each section has
an ID byte, a size, and its payload. Vectors begin with their element count.

Unsigned LEB128 encodes section sizes, vector counts, indices, and branch depths.
Signed LEB128 encodes i32 constants. f32 values use IEEE 754 little-endian bytes.
The encoder helpers live in `src/wasm/encoding.ts`.

A code-section function body contains a length, local declaration groups,
instructions, and its terminating end. User function types are `(f32, ...) -> f32`.
Run is `() -> void`. Printing imports are `(f32) -> void` and `(i32) -> void`.

The official specification documents
[index encoding](https://webassembly.github.io/spec/core/binary/modules.html#indices)
and [integer encoding](https://webassembly.github.io/spec/core/binary/values.html#integers).

## 8. Branch to structured labels

A while loop emits an outer block and inner loop. A branch to the outer block
exits; a branch to the loop repeats. Branch operands count enclosing labels from
zero, rather than representing instruction addresses.

Nested if blocks add labels. The compiler tracks absolute control depth and records
loop target depths. At each break/continue, subtraction yields the relative depth.
The emitted depths are unsigned LEB128. Empty while bodies retain the back edge;
a true empty loop does not become a no-op.

For bodies add a third block to preserve increment behavior as described above.
Generated pixel bounds checks add a block too, but contain no ASTRA statements and
therefore do not introduce user-visible break/continue positions.

## 9. Register functions before emitting calls

The first function pass records names, indices, and parameter counts. The second
emits run and then each user body. Recursive and forward calls can resolve their
indices because registration is complete. Imports occupy indices 0 and 1, run is
2, and user functions follow in declaration order.

Each body gets fresh locals, scopes, loop state, and function context. Calls check
arity; duplicate function/parameter names are errors. Return is valid only inside
a function. A fallback `return 0` is appended regardless of the final encoded byte.
An earlier explicit return makes that fallback unreachable but still valid WASM.

Looking at the last byte is insufficient: an immediate local index 15 is also
0x0f, the return opcode. Instruction boundaries and control flow determine meaning.
Choose **A function calls itself** to inspect factorial's call to its own index.

## 10. Make memory observable

Each canvas pixel occupies four RGBA bytes at `(y * width + x) * 4`. Alpha is 255
for written pixels. Pixel operands are evaluated once, left to right, cached in
locals, converted to i32, and checked against the canvas bounds before stores.
Coordinates truncate toward zero. Invalid numeric conversions trap; valid
out-of-canvas coordinates are ignored. Channel stores keep the low eight bits.

Memory allocation rounds `width * height * 4` up to 64 KiB pages, with at least one
page. Dimensions belong to a compilation, not mutable module globals. Runtime
instances capture their own dimensions and copy raw RGBA bytes to ImageData.

Mandelbrot combines nested loops, f32 arithmetic, early exits, and pixel addressing.
It is a useful integration workload, but its picture is not a substitute for
behavioral regression tests.

## 11. Inspect the executable, not a reconstruction

`src/wasm/inspect.ts` reads section boundaries, code bodies, locals, opcodes, and
immediates from the actual emitted byte array. Function names come from the compiler
AST for readable labels. Unknown opcodes are rejected instead of guessed.

This is intentionally a decoder for ORION's instruction subset. It is not a general
WASM debugger. The Lab has no source stepping, breakpoints, or live stack simulation.
It shows compile-time artifacts; generated programs still execute in the WASM engine.
Tokens and AST are sent directly from the real frontend. Large DOM views are bounded,
and full WASM downloads remain available.

## 12. Keep the editor outside program execution

The browser starts a disposable worker for each job. All compilation and execution
happen there. The main thread owns the editor, cancellation, deadline, and rendering.
The worker sends compiled artifacts before optional execution, batches print output,
and transfers final pixel memory on success.

The main thread terminates the worker on Stop or after eight seconds. It ignores
late messages from obsolete workers. Console output stops at 1,000 numeric values.
Restored/shared code is compiled without automatically executing. The reusable
low-level tick API remains synchronous and requires caller-provided isolation.

## 13. Verify a language contract

`npm test` runs the original core suite and the newer regression/integration checks.
Those cover failed review cases, all examples, raw pixel bytes, decoder offsets,
runtime rendering, output capping, worker termination, and compile-only behavior.

`tests/conformance.json` records portable input/output, pixel, and error expectations.
A future Rust compiler should satisfy these fixtures before performance comparisons.
Different implementations may produce different valid binaries. Measure compiler
latency independently from generated-program execution.

## 14. Know the boundaries

There is no optimizer, general heap, arrays, strings, closures, or separate semantic
analysis pass. Source spans are present on tokens, but not carried through every
semantic diagnostic. f32 arithmetic has finite precision. Deep recursion can exhaust
the engine stack. These limits are explicit parts of the present scope.

The next milestone is the Rust implementation. Its first job is preserving behavior,
not adding a different language under the same name.
