import { compile } from "./compiler";
import { Runtime } from "./types/runtime";

export const runtime: Runtime = async (src, environment) => {
  const wasm = compile(src);

  const buffer = new Uint8Array(wasm).slice().buffer;

  const result = await WebAssembly.instantiate(
    buffer,
    ({ env: environment } as unknown) as WebAssembly.Imports
  );

  return () => {
    (result.instance.exports.run as Function)();
  };
};
  