# ORION 1.1 — Playground and Lab

Public playground: https://orion-playground.cocoadace4.chatgpt.site

The header theme button switches between deep cream/orange and charcoal.
It follows the system preference until you choose a theme, then remembers that
choice on this device. Monaco, the Lab, inputs, and dialogs change together.
The small **i** beside each graphics/functions example explains its rule and
rendering. Opening an explanation does not select or execute that example.

## Start

Run `npm install`, then `npm run dev`, and open http://localhost:5173.
Build with `npm run build`; inspect that exact build with `npm run preview`.

## Explore

The program chooser contains three guided compiler lessons and twelve graphics/functions
examples. Selecting a graphics example runs it at its suggested canvas size.
Selecting a lesson compiles it and opens the Lab without executing it.

The editor supports Run (`Ctrl+Enter` / `Cmd+Enter`), Stop (`Escape` while running),
and a simple indentation formatter. Format is undoable. It does not reformat the
full expression grammar. Selecting an example is undoable in the editor. The
sidebar groups the programs in a visible list. On narrow screens, a native selector
replaces the list, and Code / Result buttons switch the working panel. Running
a program opens Result. The workspace fits the viewport; source, examples, and
compiler output scroll within their own panes.

**Take a closer look** opens the Lab for the current editor contents. It compiles
only when the source or canvas dimensions have changed; it never substitutes a
lesson or executes the program. Opening the Lab preserves the last execution's
canvas and console. Lessons are selected explicitly in the program chooser.

## Output

Graphics get a large canvas and a compact console summary. Numeric programs show
the console without a blank canvas. Programs that draw and print show both.

- Canvas dimensions are integers from 1 to 500. Resizing clears the canvas; run
  again to render at the new size. Examples have explicit loop bounds, so larger
  canvases do not automatically scale the program's coordinates.
- Out-of-canvas writes are ignored. Color values should be 0–255; the emitted byte
  stores wrap other integral values. Save the canvas with its download arrow.
- The console shows up to 1,000 printed values, then a truncation notice. Computation
  continues. Clear removes the visible log.
- Compile time covers tokenization, parsing, and emission. WASM validation time
  measures WebAssembly.compile. Execute measures the generated run function,
  including imported printing. Worker startup, inspection rendering, canvas copy,
  and instantiation are not included in those figures.

## Lab

**Tokens** lists actual lexer output, including line and column. Clicking a value
selects its source range. Source linking is disabled when the editor differs from
the inspected build. The display is capped at 2,000 tokens.

**AST** is an expandable view of the actual compiler AST. `for` is already lowered
to a block and while node; `update` contains the increment. Rendering is capped at
4,000 tree entries.

**Instructions** decodes the emitted WASM code section. The function menu includes
`run` and user functions. Offsets are absolute byte offsets into the module.
`local.get` indices include parameters first. Imported functions occupy indices
0 and 1; `run` is 2, followed by user functions. Click an instruction to open Bytes
and highlight its complete encoding, including immediates. Up to 2,000 instructions
per function are shown.

**Bytes** groups the module by header and section. Section size includes the section
ID and size encoding. Large sections display a 2 KiB window near the selected
instruction. Download .wasm saves the complete module regardless of display limits.
The decoder handles ORION's emitted subset; it is not a general WASM disassembler.

Compile updates the Lab without executing the program. Run updates both. Editing
source leaves the last build visible with a stale-build notice until you compile.

## Guided lessons

1. **An expression becomes bytes:** tokenize `print (2 + 3)`, expand its tree,
   inspect stack instructions, and locate the `92` byte for `f32.add`.
2. **Where does continue go?:** inspect lowered nested loops and relative branch
   depths; run to check the expected output `0, 2, 10, 12`.
3. **A function calls itself:** inspect factorial's parameter and recursive call;
   run to check 120.

Lesson arrows move through the explanation and select the relevant inspection tab.
The tabs also work independently of lesson steps.

## Isolation and local state

Compilation, validation, inspection decoding, and execution happen in a disposable
worker. Stop terminates it. An eight-second deadline applies to the entire job,
including worker startup. A cancelled or timed-out program can be corrected and
run again immediately. The main editor stays responsive during a WASM loop.

The app saves the current source, example identity, and dimensions in localStorage.
It does not upload code or use analytics. Share puts source and dimensions in a URL
fragment and opens a copy dialog. Treat the URL as readable source. Large programs
can produce impractically long share links; sharing a file is preferable for those.
Restored and shared programs compile on opening without automatically executing.

## Troubleshooting

A syntax error appears in the console and, when it has source coordinates, as an
editor marker. Semantic errors currently identify names but do not all carry source
spans. Missing `end`, wrong arity, duplicate declarations, or return outside a
function are errors. Functions cannot access the top-level run function's locals.

A time-limit message usually means a loop does not advance, or the workload is too
large for the eight-second limit. Deep recursion can exhaust the WASM call stack.
Numeric coordinate/channel conversions can trap for NaN, infinity, or values outside
signed i32 range. Arithmetic and variables use f32, so high precision is not promised.

## Static hosting

Deploy the built `dist/` directory when ready. No server-side execution, API keys,
or environment variables are required. Use HTTPS for reliable clipboard support.
Configure Vite's base path if hosting below an origin subpath. Hosting and public
publication were deliberately deferred for this change.
