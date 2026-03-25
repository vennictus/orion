import { compile } from "./compiler";
import { Runtime } from "./types/runtime";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./wasm/module";

/* ---------- RENDER CONFIG ---------- */

function makePalette(): Uint8Array {
  const palette = new Uint8Array(256 * 3);

  for (let i = 0; i < 256; i++) {
    const t = i / 255;

    // classic smooth Mandelbrot palette
    palette[i * 3 + 0] = Math.floor(9 * (1 - t) * t * t * t * 255);
    palette[i * 3 + 1] = Math.floor(15 * (1 - t) * (1 - t) * t * t * 255);
    palette[i * 3 + 2] = Math.floor(
      8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255
    );
  }

  return palette;
}

/* ---------- RUNTIME ---------- */

export const runtime: Runtime = async (src, environment) => {
  // Compile Astra source → WASM bytes
  const wasm = compile(src);

  // Force ArrayBuffer (not SharedArrayBuffer)
  const buffer = new Uint8Array(wasm).buffer;

  // Compile WASM module
  const module = await WebAssembly.compile(buffer);

  // Instantiate with imports
  const instance = await WebAssembly.instantiate(module, {
    env: {
      print_f32: environment.print,
      print_i32: environment.print,
    },
  });

  /* ---------- WASM MEMORY ---------- */

  const memory = instance.exports.memory as WebAssembly.Memory;

  if (!memory) {
    throw new Error("WASM memory not exported");
  }

  const memBuffer = new Uint8Array(memory.buffer);

  /* ---------- RENDERER ---------- */

  const palette = makePalette();

  function renderToCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D context not available");
    }

    const image = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let i = 0; i < CANVAS_WIDTH * CANVAS_HEIGHT; i++) {
      const iter = memBuffer[i];

      const r = palette[iter * 3 + 0];
      const g = palette[iter * 3 + 1];
      const b = palette[iter * 3 + 2];

      image.data[i * 4 + 0] = r;
      image.data[i * 4 + 1] = g;
      image.data[i * 4 + 2] = b;
      image.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);
  }

  /* ---------- TICK FUNCTION ---------- */

  const tick = () => {
    (instance.exports.run as Function)();
  };

  // attach renderer without breaking call signature
  tick.renderToCanvas = renderToCanvas;

  return tick;
};
