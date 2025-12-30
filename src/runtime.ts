import { compile } from "./compiler";
import { Runtime } from "./types/runtime";

export const runtime: Runtime = async (src, environment) => {
  const wasm = compile(src);

  // 🔑 force real ArrayBuffer (not SharedArrayBuffer)
  const buffer = new Uint8Array(wasm).buffer;

  const module = await WebAssembly.compile(buffer);

const instance = await WebAssembly.instantiate(module, {
  env: {
    print_f32: environment.print,
    print_i32: environment.print,
  },
});


  return () => {
    (instance.exports.run as Function)();
  };
};
