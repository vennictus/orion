import { tokenize } from "../src/tokenizer";
import { parse } from "../src/parser";
import { emitter } from "../src/wasm/module";
import { inspectBinary } from "../src/wasm/inspect";
import { MAX_OUTPUT_LINES, MAX_SOURCE_LENGTH, WorkerRequest, WorkerResponse } from "./protocol";

const send = (message: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(message, { transfer });

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { source, width, height, execute } = event.data;
  let batch: number[] = [];
  let printed = 0;
  const flush = () => {
    if (batch.length) send({ type: "output", values: batch });
    batch = [];
  };
  try {
    if (source.length > MAX_SOURCE_LENGTH) throw new Error("Source limit is 100,000 characters. Try a smaller program.");
    const start = performance.now();
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const wasm = emitter(ast, { width, height });
    const compileMs = performance.now() - start;
    const validateStart = performance.now();
    const module = await WebAssembly.compile(wasm.slice().buffer);
    const validationMs = performance.now() - validateStart;
    const inspection = inspectBinary(wasm, ast.filter(n => n.type === "functionDeclaration").map(n => n.name));
    send({ type: "compiled", tokens, ast, wasm, inspection, compileMs, validationMs });
    if (!execute) return;
    const print = (value: number) => {
      if (printed >= MAX_OUTPUT_LINES) return;
      batch.push(value);
      printed++;
      if (batch.length === 50) flush();
      if (printed === MAX_OUTPUT_LINES) send({ type: "output", values: [], truncated: true });
    };
    const instance = await WebAssembly.instantiate(module, { env: { print_f32: print, print_i32: print } });
    const executionStart = performance.now();
    (instance.exports.run as () => void)();
    const executionMs = performance.now() - executionStart;
    flush();
    const memory = instance.exports.memory as WebAssembly.Memory;
    const pixels = memory.buffer.slice(0, width * height * 4);
    send({ type: "complete", pixels, executionMs }, [pixels]);
  } catch (error) {
    flush();
    send({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
