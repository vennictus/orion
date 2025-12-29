import { compile } from "./compiler";

async function main() {
  const wasm = compile("print 8 print 24");

  console.log("WASM bytes:", wasm.length);

  const buffer = wasm.buffer.slice(
    wasm.byteOffset,
    wasm.byteOffset + wasm.byteLength
  );

  // 👇 THIS is the test
 const result = await WebAssembly.instantiate(
  buffer as BufferSource
);

const instance = result.instance;


  console.log("Exports:", Object.keys(instance.exports));

  // run exists but does nothing yet
  (instance.exports.run as Function)();

  console.log("OK: module instantiated and ran");
}

main().catch(console.error);
