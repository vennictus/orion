# ORION

A compiler you can look inside.

ORION is a TypeScript compiler for **ASTRA**, a small numeric language. It emits
WebAssembly binary bytes directly: source → tokens → AST → WASM. The playground
lets you run a program, see its pixels, and inspect the executable it produced.

## Run locally

```sh
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173). Requires Node.js 20.19+ or 22.12+.

```sh
npm test             # Core, regression, examples, conformance, inspector, worker tests
npm run typecheck    # Compiler, tests, browser UI, workers, and Vite configuration
npm run build        # Static production output in dist/
npm run preview      # Preview the production build locally
```

## The playground

- **Output:** an RGBA canvas, numeric console output, and separate compile,
  WebAssembly-validation, and execution timings.
- **Lab:** source-located tokens, an expandable compiler AST, decoded instructions
  for each function, and a sectioned hexadecimal view of the actual WASM binary.
- **Linked inspection:** click a token to select its source; click an instruction
  to highlight its encoded bytes. Download the `.wasm` module or save the canvas.
- **Guided examples:** arithmetic, nested loop branches, and recursive factorial.
  Twelve additional examples cover fractals, patterns, shapes, and functions.
- **Isolated execution:** compilation and execution run in a disposable worker.
  Stop cancels it; an eight-second deadline also applies. Console output is capped
  at 1,000 values.
- **Local workspace:** source and canvas size are saved in browser localStorage.
  Share creates a URL with source in its fragment. Shared and restored programs
  compile on opening, but do not execute automatically.

The interface pairs deep cream and orange with serif headings and a matching
charcoal dark theme. The theme toggle follows your system initially and remembers
your choice. Small info buttons explain each graphics/functions example without
running it. A grouped program list sits beside the editor; on phones, a native selector keeps it compact.
“Take a closer look” inspects your current source and preserves the last output.
No external font or analytics
service is loaded. Source is not uploaded by the app; copying a share link is an
explicit way to disclose its contents to recipients.

## ASTRA in a minute

```astra
fn factorial(n)
  if (n <= 1)
    return 1
  end
  return (n * factorial((n - 1)))
end

print factorial(5)

for y in 0..100
  for x in 0..100
    setpixelrgb x y (x * 2) (y * 2) 180
  end
end
```

ASTRA supports variables, assignment, lexical shadowing, arithmetic, comparisons,
logical operators, unary negation, `not`, `if`/`else`, `while`, `for`, `break`,
`continue`, numeric functions, and recursion. Comments start with `//`.

Binary expressions use parentheses: `(x + 3)`. Additional grouping is accepted.
Function calls require the opening parenthesis adjacent to the name: `f(1, 2)`.
Arguments and parameters require commas, without trailing commas. `for i in 0..n`
starts at zero, steps by one, and excludes n; its end expression is evaluated on
**every condition check**. `continue` executes the generated increment.

Variables, parameters, arithmetic, and function results use **f32**, with its normal
rounding and precision limits. Signed-i32-range integral literals initially use
`i32.const`; larger finite literals use `f32.const`. Comparison and logical results
are 0 or 1. Numeric conditions use zero/nonzero truthiness. Logical `&&` and `||`
**evaluate both operands**. Functions falling through return 0. Functions cannot
capture top-level variables. Duplicate bindings in one scope, wrong call arity,
invalid return context, and missing delimiters are rejected.

## Graphics

```astra
setpixel 0 0 128
setpixelrgb 1 0 255 100 40
```

Pixels live at `(y * width + x) * 4`, in red, green, blue, alpha order. Alpha is 255
for written pixels; unwritten pixels are transparent. Coordinates and channel
values truncate toward zero. Coordinates outside the canvas are ignored; channels
store their low eight bits, so values outside 0–255 wrap rather than clamp.
Non-finite or out-of-i32-range coordinate/channel conversions trap. Operands are
evaluated once, left to right, before the coordinate bounds check.

The playground and compiler accept integer dimensions from 1 to 500. Each compiled
module has its own canvas dimensions and enough memory, rounded to 64 KiB pages.

## Architecture

```text
ASTRA → tokenize → parse → emitter → WebAssembly binary
                                      ↓
                              inspectBinary → Lab
                                      ↓
                              WebAssembly engine → output
```

`for` lowers to a scoped declaration and a while node with a separate update.
The emitter registers functions before generating bodies, enabling forward calls
and recursion. It writes module sections and instruction bytes without an external
WAT compiler. The Lab decoder reads those actual bytes, rather than reconstructing
an approximation from the AST.

| File | Purpose |
| --- | --- |
| `src/tokenizer.ts`, `src/parser.ts` | Frontend and source-located syntax errors |
| `src/wasm/module.ts` | Typed AST lowering and binary emission |
| `src/wasm/encoding.ts`, `constants.ts` | Binary encodings and opcodes |
| `src/wasm/inspect.ts` | Decoder for ORION's emitted instruction subset |
| `src/compiler.ts`, `src/runtime.ts` | Public compile and low-level tick APIs |
| `playground.ts`, `playground/styles.css` | Browser interface |
| `playground/runner.worker.ts` | Compilation and execution isolation |
| `playground/examples.ts` | Examples and guided Lab lessons |
| `tests/conformance.json` | Portable behavior fixtures for future implementations |

See [GUIDE.md](GUIDE.md), [ARCHITECTURE.md](ARCHITECTURE.md), and
[PLAYGROUND.md](PLAYGROUND.md) for implementation and usage details.
[BLOG.md](BLOG.md) is an editable article draft; [POST.md](POST.md) contains a
short release post draft. Nothing has been published automatically.

## Limits

ORION is an educational compiler, not an optimizing production toolchain. There
are no arrays, strings, general heap allocation, closures, or source-level stepping.
The AST panel shows the lowered compiler AST. The binary decoder supports ORION's
instruction subset, not arbitrary WASM modules. Source is limited to 100,000
characters; inspection views also bound their rendered rows. Stack exhaustion,
floating-point overflow, and invalid numeric conversions can still trap or produce
non-finite arithmetic results.

The low-level runtime's tick is synchronous and has no deadline; applications must
isolate it themselves. The playground provides that isolation. Timing figures are
per-run measurements, not benchmark claims.

## Publish later

`npm run build` produces `dist/`, ready for a static host. It needs no backend or
secrets. Netlify Drop accepts the folder; Git-based hosting uses build command
`npm run build` and publish directory `dist`. Use HTTPS for clipboard sharing.
The default Vite base path assumes hosting at an origin root; configure `base` for
subpath hosting such as a GitHub Pages project URL.

## License

MIT. Copyright 2026 Ishjaap Singh.
