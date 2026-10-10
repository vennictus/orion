# ORION cross-check — 9 October 2026

> Historical audit, recorded before the 1.1 changes. The compiler defects below
> have since been addressed with regression coverage. See [CHANGELOG.md](CHANGELOG.md)
> for the current implementation and validation; the measurements below describe
> the earlier build.

Reviewed the compiler pipeline, AST types, WebAssembly encoding/emission, runtime,
playground code and examples, build configuration, tests, and accompanying docs.
This report records findings; implementation files were not changed.

## Verification

- `npm test`: passed, with **52 successful assertions**.
- `npm run typecheck`: passed.
- Additional TypeScript check including `playground.ts`, `main.ts`, and
  `vite.config.ts`: passed with strict mode and bundler module resolution.
- `npm run build`: passed after retrying outside the filesystem sandbox. The
  initial EPERM was environmental. Vite warned about large chunks; the main JS
  bundle is about 3.76 MB, or 974 KB gzipped.
- All **12 playground examples** compiled, validated, and executed in Node with
  their declared canvas sizes and a five-second execution timeout per example.
- Targeted edge cases below were run against the real compiler and WebAssembly
  engine. Potentially hanging programs were bounded using Node VM timeouts.
- Runtime rendering was checked with a mock canvas context capturing ImageData.
- Browser interaction, visual layout, and screenshot equivalence were not tested.

## Confirmed defects

### 1. P1 — `continue` skips the generated `for` increment

Locations: `src/parser.ts:418–447`, `src/wasm/module.ts:460–470`.

```astra
for i in 0..3
  if (i == 1)
    continue
  end
  print i
end
```

The parser appends the increment after the body. `continue` branches directly to
the while condition, skipping it. The program prints 0, then hangs at i = 1
(confirmed by timeout). Preserve an increment target when lowering `for` loops.

### 2. P1 — Playground execution can block the entire UI

Location: `playground.ts:705`.

`run()` executes synchronously on the browser main thread, with no cancellation
or execution budget. `while (1) print 1 end`, or defect 1, prevents the editor and
controls from responding. A try/catch cannot interrupt a running loop. Execute
programs in a terminable worker and bound console output. This conclusion follows
from the execution path; an actual browser freeze was not induced.

### 3. P2 — Standalone runtime renders the wrong memory layout

Location: `src/runtime.ts:64–80`.

The emitter writes four RGBA bytes per pixel; the runtime still reads `memBuffer[i]`
as a single iteration count and applies a palette. With adjacent red and green
pixels, the captured rendered result was two black pixels. The playground's raw
RGBA renderer uses the correct layout. Update the runtime to match, or explicitly
provide a separate palette mode reading the red byte at `i * 4`.

### 4. P2 — Default-return detection inspects a byte rather than an instruction

Location: `src/wasm/module.ts:654`.

A function containing sixteen local declarations and no explicit return fails
WebAssembly validation instead of returning the documented default 0. Its final
`set_local 15` ends with byte `0x0f`, which is mistaken for the return opcode.
Determine termination from the AST/control flow, or append a valid fallback
unconditionally.

### 5. P2 — Logical operators depend on whether a number is stored in a variable

Locations: `src/wasm/module.ts:166–172`, logical binary emission.

```astra
let a = 2
print (a && 1)
print (2 && 1)
print (2 || 1)
```

Observed output: `[1, 0, 3]`. Integer operands are passed straight to bitwise
AND/OR, while f32 operands are normalized to booleans. Normalize both numeric
types to 0/1. Both operands are also evaluated eagerly; short-circuit behavior
should be explicitly specified before treating that separate choice as a defect.

### 6. P2 — `while` rejects stored boolean conditions

Locations: `src/wasm/module.ts:390–391`, `422–423`.

```astra
let flag = (1 < 2)
while (flag)
  flag = 0
end
```

Compilation throws `while condition must be i32`. Variables are stored as f32,
including comparison results. `if` and logical operators already support their
truthiness. Apply equivalent conversion to while conditions.

### 7. P2 — Empty loops evaluate their condition only once

Location: `src/wasm/module.ts:383–403`.

`while (1 == 1) end print 99` immediately prints 99. The empty-body path emits a
block without a back edge. This changes loop semantics, including conditions
with function calls. Retain normal loop emission for empty bodies.

### 8. P2 — Missing `end` tokens are silently accepted

Locations: `src/parser.ts:39`, callers of `eat("end")`.

`if (1) print 2` compiles and prints 2. `fn f() return 2` is also accepted.
`eat()` returns silently at EOF even when a mandatory token was requested.
Reject EOF when an expected token has not been consumed.

### 9. P2 — Out-of-range integer literals silently wrap

Location: `src/wasm/module.ts:187–190`; bitwise shifts in `signedLEB128`.

`print 2147483648 print 4294967296` prints `[-2147483648, 0]`. Every whole-valued
literal enters i32 encoding, regardless of range. Check the signed i32 range,
then emit f32 or report an explicit range error according to the language policy.

### 10. P2 — Function declarations/calls lack semantic validation

Locations: `src/wasm/module.ts:229–238`, `608–613`, `src/parser.ts:474–524`.

- `fn f(x) return x end print f()` and `print f(1,2)` emit invalid WASM instead of
  reporting argument-count errors during compilation.
- Duplicate function names overwrite registry entries. Two different signatures
  can produce invalid local indices; equal signatures silently use the last body.
- Duplicate parameter names are accepted and overwrite each other's bindings.
- Top-level `return 1` is accepted and terminates the void run function, discarding
  the value. The existing `inFunction` state is not checked in return emission.

Validate arity, unique function/parameter names, and return context before emission.

### 11. P2 — Pixel expressions execute repeatedly

Locations: `src/wasm/module.ts:481–577`.

```astra
fn c()
  print 1
  return 10
end
setpixel 0 0 c()
```

This prints 1 three times. Coordinate expressions are evaluated four times per
pixel, and grayscale values three times. User functions make those expressions
observable, so this is more than redundant arithmetic. Cache the computed address
and channel values in temporary locals.

## Additional parser/configuration observations

- Function arguments and parameters accept missing commas, despite being described
  as comma-separated: `fn f(x y) return (x + y) end print f(1 2)` prints 3.
- Function-call adjacency checks column numbers without checking line numbers
  (`src/parser.ts:101`). An identifier at the end of one line can be mistaken for
  a call when the next line's opening parenthesis has the matching column.
- `..` is a tokenizer operator but is not an expression operator. The parser casts
  it to `Operator`; a binary range expression reaches an undefined opcode entry
  instead of producing a useful parser error.
- `tsconfig.json` includes only `src`. The normal typecheck excludes the playground,
  standalone entry point, and Vite configuration. Those files passed the extra
  manual check, but future errors there will escape the npm check.
- Canvas dimensions are mutable module exports read by runtime rendering. A later
  emitter call with a different size can change the dimensions used to render an
  existing runtime instance. Capture dimensions per instance.
- Pixel bounds are deliberately unchecked, as ARCHITECTURE.md acknowledges.
  `setpixelrgb 100 0 1 2 3` on a 100-wide canvas writes `[1,2,3,255]` to pixel
  `(0,1)`. Out-of-canvas writes need not trap because WASM checks allocated memory,
  not canvas coordinates.

## Documentation cross-check

| Location | Discrepancy |
| --- | --- |
| README.md:78,216 | Says 51 checks; the suite currently reports 52 successful assertions. |
| CHANGELOG.md:79 | Says 45 tests. If historical, label that snapshot clearly rather than presenting it as the current total. |
| PLAYGROUND.md:27; GUIDE.md:2299 | Says port 3000; vite.config.ts sets 5173, which README correctly documents. |
| GUIDE.md:882–890 | Incorrectly says branch depths require signed LEB128. Label indices are u32 and use unsigned LEB128. The current signed encoder produces accepted redundant encodings for the small nonnegative depths tested; this is primarily a spec/explanation correction. |
| GUIDE.md:1308–1310 | Says `5` and `5.0` differ in type. Both become Number(5), and both take the same Number.isInteger branch. |
| GUIDE.md sections 20–23 | Describe one-byte grayscale memory, one page, and palette rendering; the current emitter uses RGBA and dynamic page allocation. Later sections describe the new layout, leaving contradictory instructions. |
| GUIDE.md:2479 | Says helpers are closures inside emitter; current helpers are top-level functions receiving state. |
| GUIDE.md:2491 | Explains the logical fix using tracked variable types; declarations actually normalize variables to f32, and logical use sites perform truthiness conversion. |
| GUIDE.md:2571–2576; PLAYGROUND.md troubleshooting | Suggest out-of-canvas coordinates necessarily exceed memory. Page rounding and row spill make many such writes silently succeed. |
| BLOG.md graphics discussion | Groups runtime and playground rendering together; their implementations currently disagree as shown in defect 3. |
| PLAYGROUND.md security section | Browser sandboxing does not establish responsiveness or termination. Qualify the public-deployment claim until execution cancellation and output limits exist. |
| README versions, GUIDE status, package.json/UI | Refer to v2.0, v1.1.0, and v1.0.0 without a consistent distinction between feature phases and package releases. |

The WebAssembly encoding correction was checked against the official
[index encoding](https://webassembly.github.io/spec/core/binary/modules.html#indices)
and [integer encoding](https://webassembly.github.io/spec/core/binary/values.html#integers)
specification sections.

Documentation code blocks were also compile-checked. Some are intentional fragments,
operator lists, invalid examples, or proposed syntax, so failures alone are not
counted as implementation bugs. GUIDE.md's annotated ASTRA examples include literal
arrows that cannot be pasted into the compiler; mark annotations as comments if
those blocks are intended to be executable.

## Suggested order

Fix `for` continuation and isolate playground execution first. Then align runtime
rendering, repair default returns, normalize booleans, enforce parser delimiters,
and add semantic validation. Add regression coverage for these behavior changes,
then reconcile the guide with the implementation and correct the small setup/count
discrepancies. The passing existing suite is a baseline, not evidence that these
edge cases work.
