import { compile } from "./compiler";

async function testPrint() {
  const output: number[] = [];

  const wasm = compile("print 8 print 24");
  const buffer = new Uint8Array(wasm).buffer;

  const module = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(module, {
    env: {
      print: (value: number) => output.push(value),
    },
  });

  (instance.exports.run as Function)();

  // 🔒 HARD ASSERTION
  if (JSON.stringify(output) !== JSON.stringify([8, 24])) {
    throw new Error(`Print failed: ${JSON.stringify(output)}`);
  }

  console.log("✅ print test passed:", output);
}

testPrint().catch(console.error);
