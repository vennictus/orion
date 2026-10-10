# ORION changelog

## 1.1.0 — 9 October 2026

The playground now includes a compiler Lab and warm light/dark themes.

### Compiler correctness

- For-loop continue executes the generated update, including in nested control flow.
- Empty while loops retain their back edge; stored numeric conditions are accepted.
- Integer and float logical operands normalize to 0/1. Logical operators remain eager.
- Whole-valued literals beyond signed i32 range emit as f32; non-finite-range literals
  are rejected rather than silently wrapping.
- Required block terminators and comma-separated argument/parameter lists are enforced.
- Duplicate function/parameter/same-scope variable names, wrong call arity, and invalid
  return context are rejected before WebAssembly instantiation.
- Call adjacency checks both line and column; unsupported expression operators fail
  with a parser diagnostic. Ordinary expression grouping is accepted.
- Default returns no longer mistake immediate bytes for opcodes.
- Pixel operands execute once in source order. Out-of-canvas writes are ignored.
- Canvas dimensions belong to each compilation/runtime instance. Runtime rendering
  uses the emitter's RGBA memory layout.
- AST emitters use discriminated unions rather than untyped node arguments.

### Playground and Lab

- Deep cream/orange interface with serif headings, matching charcoal dark theme,
  persisted theme choice, a grouped example chooser and two-panel workspace,
  accessible dialogs and controls, and reduced-motion support.
- Actual token table with source selection, expandable lowered AST, function-level
  binary instruction decoding, sectioned hex, linked byte highlighting, WASM download.
- Three guided lessons: arithmetic, nested loop branches, and recursive factorial.
- Small info buttons explain all twelve graphics/functions examples in accessible
  dialogs, including their rules and finite fractal approximations.
- Inspection preserves the current program and its last output; changing canvas
  dimensions invalidates the compiled artifact. Explicit example changes are undoable.
- Output adapts to graphics, printed results, or both, avoiding empty canvas/console panels.
- Twelve existing graphics/functions examples retained; the default Mandelbrot now
  renders a 240 × 180 canvas with a blue palette.
- Disposable workers, Stop, eight-second timeout, bounded/batched console output.
- PNG export, local workspace recovery, source-in-fragment sharing with no auto-run.
- Compile, WASM validation/compilation, and execution are timed separately.
- Monaco uses its standalone editor and editor worker, excluding unrelated language
  workers from the production output.

### Verification and docs

- Original core tests retained; regressions cover compiler failures, all examples,
  inspection offsets, runtime RGBA, worker isolation, and console limits.
- Portable JSON conformance fixtures establish a baseline for a future Rust port.
- Typecheck now includes tests plus a browser configuration covering the UI and workers.
- README, guide, architecture, and playground docs reconciled with implementation.
- Production static build prepared. Hosting/publication deferred at the user's request.

## March–April 2026 — Earlier feature work

Added user-defined numeric functions, recursion, unary operators, additional
comparisons, OR, for loops, RGB graphics, dynamic canvas dimensions, and the Monaco
playground. April changes expanded checks and repaired example programs.

## January 2026 — Initial compiler

Source tokenization, recursive descent parsing, direct WebAssembly emission,
variables/scopes, arithmetic/comparisons, if/while, loop branches, grayscale graphics,
and the original Mandelbrot validation workload.
