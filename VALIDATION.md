# ORION 1.1 validation

Verified locally on 9–10 October 2026.

## Viewport fit and program list follow-up — 10 October

The visible grouped program sidebar is restored. The header is compact and the
workspace fills the remaining viewport. Only the source, example list, and Lab
content scroll. Phones use a native program selector and Code / Result controls;
Run opens Result, where Stop remains available during execution.

Typecheck and production build pass. Browser verification confirmed:

- No page overflow at 1366 × 768, 1024 × 600, and 390 × 651.
- Short-window guided lessons retain a scrollable compiler inspection pane.
- Phone program selection, Code / Result switching, Run, and Stop work. Stop
  interrupted an infinite loop and returned the editor to a usable state.
- Taking a closer look preserves the selected program.
- Light and dark layouts render correctly; no browser warnings or errors appeared.

Current captures: `artifacts/viewport-fit-light.jpg` and
`artifacts/viewport-fit-mobile.jpg`. Earlier redesign notes below describe the
previous dialog chooser, superseded by this visible list.

## Workspace redesign follow-up

The deeper cream/orange redesign replaces the permanent sidebar with a grouped
program chooser, enlarges the two working panels, and adapts output to graphics,
multiple printed values, or a single centered result.

Typecheck, production build, and all 127 automated checks pass. Browser checks:

- “Take a closer look” preserves the current program; fresh inspection leaves the
  rendered canvas in place. Edited source compiles without executing it: after
  printing 137, inspecting `print 138` retains output 137 and inspects 138.
- Choosing an example is undoable. Example recognition and guided lessons work
  after replacement, including models using Windows line endings.
- Resizing a pixel program changes the emitted binary at the next inspection;
  pending numeric input is committed before compilation.
- Compilation errors appear inside the Lab. Single-result output displays 120
  for the recursive factorial lesson, with no unused canvas.
- The chooser and nested example explanations work on phone layouts; Escape
  returns from the explanation to the chooser.
- Phone (390 px) and tablet (850 px) checks show no page-wide overflow. Both
  themes render correctly, and production browser logs contain no errors/warnings.

Current screenshots: `redesign-light.jpg`, `redesign-dark.jpg`,
`redesign-mobile.jpg`, and `redesign-chooser.jpg` in `artifacts/`.

Theme follow-up: typecheck and production build pass with the ivory/terracotta and
charcoal themes. Browser checks confirmed dark preference recovery on reload,
matching editor colors, example dialogs and Escape dismissal, unchanged example
selection after opening information, and no horizontal overflow at 390 px.
New captures: `playground-warm.jpg`, `playground-dark.jpg`,
`playground-dark-mobile.jpg`, and `example-explanation.jpg` in `artifacts/`.

## Automated checks

- `npm test`: 52 original core assertions and 75 regression/example/inspector/worker checks pass.
- `npm run typecheck`: compiler, tests, browser UI, and workers pass.
- `npm run build`: production static output builds successfully.
- `git diff --check`: no whitespace errors.

The regression checks include all 15 examples, 12 portable conformance fixtures,
loop continuation and nested scopes, numeric conditions, parser rejection cases,
function validation, pixel evaluation order and clipping, independent canvas
dimensions, runtime RGBA, binary instruction boundaries, console capping, worker
termination, and compile-only behavior.

## Browser checks

- Production preview renders the default Mandelbrot image through its built worker.
- Recursive factorial prints 120; the function selector exposes its recursive call.
- Selecting `f32.add` at offset `0x5f` selects byte `92` in the emitted module.
- Token selection moves the editor to the corresponding source position.
- Editing and running source updates compilation and output.
- An infinite WebAssembly loop can be stopped; the editor remains usable.
- The same loop reaches the eight-second timeout and recovers.
- Printing 1,005 values displays 1,000 and the truncation notice.
- Shared source compiles without running; the sharing dialog contains the source fragment.
- Desktop (1,360), tablet (850), and phone (390) viewport checks show no page-wide horizontal overflow.
- No browser warning/error logs were present during the production checks.

PNG and WASM export controls are implemented. Browser download-file capture was
interrupted by a browser session disconnect, so downloaded files were not verified.

## Deliverables and limits

Screenshots are in `artifacts/`: desktop, mobile, and the linked byte view.
`BLOG.md` and `POST.md` are unpublished drafts. `dist/` is the static build;
`artifacts/orion-playground.zip` contains its files at the archive root.

The editor still dominates the main bundle: about 2.57 MB minified / 670 KB gzipped.
Vite emits its large-chunk warning. Unrelated Monaco language workers were removed,
but editor loading remains a possible future improvement.

The Lab decodes ORION's emitted subset, not arbitrary WebAssembly. This validation
establishes a tested baseline, not a proof of compiler completeness or performance.
The static playground was published through Sites on 10 October. Vercel deployment
is user-managed; the repository builds with `npm run build` and serves `dist/`.
The article and release post remain drafts.
