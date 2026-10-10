# ORION architecture

ORION compiles ASTRA directly to WebAssembly binary bytes. There is no interpreter
or intermediate WAT compilation step. JavaScript hosts printing and canvas display;
ASTRA computation executes in the WebAssembly engine.

## Frontend

`tokenize` applies prioritized regex matchers for comments, numeric literals,
keywords, identifiers, operators, punctuation, and whitespace. Comments and whitespace
are discarded; retained tokens have one-based line and column coordinates.
Keyword boundaries prevent `letter` from becoming `let` plus `ter`.

`parse` is recursive descent. Binary expressions are explicitly parenthesized;
additional grouping is accepted. It requires matching block delimiters and strict
comma-separated function arguments/parameters. Function calls require same-line
adjacency between the identifier and opening parenthesis. Only supported binary
operators are accepted in expression positions.

The program is an array of statements and top-level function declarations. `for`
lowers to a scoped declaration plus a while node with a separate `update`. That
representation is what the Lab's AST panel displays.

## Emitter and state

Each emission creates fresh state: scopes, local types/count, current structured
control depth, loop contexts, function signatures, canvas dimensions, and function
context. Canvas dimensions are immutable defaults plus per-emission options; they
are not shared mutable state.

Functions are registered in declaration order before bodies are emitted. Duplicate
function and parameter names are rejected. Calls check arity. Parameters occupy
local indices first. Other locals are allocated without reclaiming slots, preserving
shadowed bindings. Same-scope duplicate variables are rejected; nested shadowing is
allowed. Functions do not capture the run function's locals.

The emitter consumes typed AST unions. It performs semantic checks during emission;
there is no standalone semantic-analysis pass. Errors for undefined names, invalid
return/break/continue context, and invalid call signatures occur before instantiation.
Syntax errors have token locations; semantic errors do not all have source spans.

## Value model

- Integral literals in signed i32 range initially use i32.const. Other finite literals
  use f32.const; literals outside finite f32 range are rejected.
- Variables, parameters, arithmetic, and function returns use f32.
- Comparisons produce i32; numeric logical operands normalize to 0/1.
- All numeric conditions use zero/nonzero truthiness, including stored variables.
- Logical AND/OR are eager. There is no short-circuit lowering.
- Functions always have an unreachable-or-reachable default return 0 appended. The
  emitter does not infer termination by examining a final byte.

## Structured control flow

An ordinary while uses an outer block (break target) and a loop (back edge and
continue target). Empty bodies use that same structure and retain their semantics.
If/else uses nested blocks and conditional branches. Loop contexts track absolute
label depths; emitted branch operands are relative differences encoded as unsigned
LEB128.

A lowered for adds an inner block around its body. Its continue target is that
block, so branching exits the body and reaches the update before the next condition
check. Break still targets the outer block. Body scope closes before update emission,
so a shadowed variable inside the body cannot replace the induction variable.

## Binary module

Sections are emitted in this order:

| Part | Contents |
| --- | --- |
| Header | WASM magic `00 61 73 6d`, version `01 00 00 00` |
| Type | run, imported print signatures, user function signatures |
| Import | env.print_f32 and env.print_i32 |
| Function | Type index for each defined function |
| Memory | Minimum pages for the selected RGBA canvas |
| Export | run and memory |
| Code | Local declarations and executable function bodies |

Print imports occupy function indices 0 and 1. Run occupies 2; user functions follow.
Locals, function indices, section sizes, vector counts, and branch depths use
unsigned LEB128. i32 constants use signed LEB128. f32 constants use little-endian
IEEE 754 bytes.

## Graphics contract

Each pixel is four bytes at `(y * width + x) * 4`, in RGBA order. Grayscale writes
repeat the channel value; RGB writes preserve individual channels. Written alpha is
255; unwritten memory is zero. Pixel operands evaluate once in source order, then
are stored in temporary i32 locals. Coordinate bounds are checked before stores;
out-of-canvas coordinates are ignored. Color bytes wrap. Non-finite or out-of-range
numeric conversions still trap.

Memory is allocated in 64 KiB pages. Dimensions are integers from 1 to 500, with a
100 × 100 default. The runtime captures dimensions per instance and copies raw RGBA
bytes; it does not apply an iteration palette.

## Inspection

`inspectBinary` reads the actual byte array, section boundaries, local declarations,
and instruction immediates. It records absolute byte ranges for each instruction.
Names are supplied from the AST for display; instruction content and offsets come
from the binary. Unsupported opcodes fail explicitly. This decoder supports ORION's
subset, not arbitrary third-party modules.

Tokens and AST are the actual frontend results. View rendering is bounded in the
browser. Downloaded WASM remains complete. The UI marks artifacts stale after source
edits and disables source linking until the matching source is restored or rebuilt.

## Browser execution

One disposable worker owns each compile/run job. It tokenizes, parses, emits,
validates, and decodes, then sends the artifacts before optional execution. Print
output is batched and capped at 1,000 values. A final transferable buffer contains
the RGBA canvas. Errors cross the boundary as messages.

Stop and the eight-second main-thread timer terminate the worker. Message handlers
ignore obsolete worker instances. Starting a new job terminates its predecessor.
Shared/restored source compiles without automatically running. The low-level runtime
API remains synchronous after initialization; deadline isolation belongs to its caller.

## Verification and future Rust port

The test commands cover compiler behavior, syntax/semantic rejection, pixel memory,
example execution, instruction offsets, runtime rendering, and the worker protocol.
`tests/conformance.json` is a language-neutral behavior baseline. A Rust implementation
should match output, RGBA bytes, and error categories; identical binary layout is
not required. Compilation speed and generated-program execution speed must be measured
separately.
