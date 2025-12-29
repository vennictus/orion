// src/index.ts
import { emitter } from "./wasm/module";

async function main() {
  const wasm = emitter();

  // This should NOT throw
  const instance = await WebAssembly.instantiate(wasm);

  console.log("WASM module instantiated successfully");
  console.log(instance);
}

main().catch((err) => {
  console.error("Failed to instantiate WASM module:");
  console.error(err);
});
