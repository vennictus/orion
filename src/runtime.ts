import { compile } from "./compiler";
import { Runtime } from "./types/runtime";

/** Low-level synchronous tick API. The playground isolates execution in a worker. */
export const runtime: Runtime = async (src, environment, options = {}) => {
  const width = options.width ?? 100;
  const height = options.height ?? 100;
  const wasm = compile(src, { width, height });
  const { instance } = await WebAssembly.instantiate(wasm.slice().buffer, {
    env: { print_f32: environment.print, print_i32: environment.print },
  });
  const memory = instance.exports.memory as WebAssembly.Memory;
  const tick = () => (instance.exports.run as () => void)();
  tick.renderToCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context not available");
    canvas.width = width;
    canvas.height = height;
    const image = ctx.createImageData(width, height);
    image.data.set(new Uint8Array(memory.buffer, 0, width * height * 4));
    ctx.putImageData(image, 0, 0);
  };
  return tick;
};
