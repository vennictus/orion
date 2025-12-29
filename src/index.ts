import { emitter } from "./wasm/module";

async function main() {
  const wasmBytes = emitter();

  
  const wasmBuffer = new Uint8Array(wasmBytes).slice().buffer;

  const module = await WebAssembly.compile(wasmBuffer);
  const instance = await WebAssembly.instantiate(module);

  const add = instance.exports.add as (a: number, b: number) => number;

  console.log(add(5, 6)); // MUST print 11
}

main().catch(console.error);
