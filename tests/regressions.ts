import assert from "node:assert/strict";
import vm from "node:vm";
import { Worker } from "node:worker_threads";
import path from "node:path";
import fs from "node:fs";
import { compile } from "../src/compiler";
import { runtime } from "../src/runtime";
import { parse } from "../src/parser";
import { tokenize } from "../src/tokenizer";
import { inspectBinary } from "../src/wasm/inspect";
import { EXAMPLES, LESSONS } from "../playground/examples";
import { MAX_OUTPUT_LINES, WorkerRequest, WorkerResponse } from "../playground/protocol";

let checks = 0;
function check(name: string, fn: () => void) { fn(); checks++; console.log(`PASS ${name}`); }
function run(source: string, options = { width: 100, height: 100 }) {
  const output: number[] = [];
  const bytes = compile(source, options);
  assert.ok(WebAssembly.validate(bytes.slice().buffer));
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes.slice().buffer), {
    env: { print_f32: (v: number) => output.push(v), print_i32: (v: number) => output.push(v) },
  });
  vm.runInNewContext("run()", { run: instance.exports.run }, { timeout: 3000 });
  return { output, memory: new Uint8Array((instance.exports.memory as WebAssembly.Memory).buffer), bytes };
}

async function main() {
  check("for continue reaches update", () => assert.deepEqual(run("for i in 0..4 if (i == 1) continue end print i end").output, [0, 2, 3]));
  check("nested for continue and break", () => assert.deepEqual(run(LESSONS.branches.code).output, [0, 2, 10, 12]));
  check("inner body shadow does not replace for update", () => assert.deepEqual(run("for i in 0..3 let i = 20 print i continue end").output, [20, 20, 20]));
  check("while nested inside for keeps its own continue target", () => assert.deepEqual(run("for i in 0..2 let j = 0 while (j < 2) j = (j + 1) continue end print i end").output, [0, 1]));
  check("numeric and stored comparison while conditions", () => assert.deepEqual(run("let flag = (1 < 2) while (flag) print 7 flag = 0 end").output, [7]));
  check("empty while evaluates a false function condition", () => assert.deepEqual(run("fn cond() print 9 return 0 end while (cond()) end print 1").output, [9, 1]));
  check("true empty loop retains its back edge", () => assert.throws(() => run("while (1) end print 99"), /timed out/));
  check("logical operands normalize consistently", () => assert.deepEqual(run("let a = 2 print (a && 1) print (2 && 1) print (2 || 1) print (-2 && 1)").output, [1, 1, 1, 1]));
  check("logical operators retain documented eager evaluation", () => assert.deepEqual(run("fn f() print 9 return 1 end print (0 && f())").output, [9, 0]));
  check("large integral literals do not wrap", () => assert.deepEqual(run("print 2147483648 print 4294967296").output, [2147483648, 4294967296]));
  check("default return after local index 15", () => assert.deepEqual(run(`fn f() ${Array.from({ length: 16 }, (_, i) => `let a${i} = 1`).join(" ")} end print f()` ).output, [0]));
  check("conditional returns and fallback validate", () => assert.deepEqual(run("fn f(n) if (n) return 3 end end print f(0) print f(1)").output, [0, 3]));
  check("pixel operands evaluated once in source order", () => {
    const result = run("fn x() print 1 return 0 end fn y() print 2 return 0 end fn c() print 3 return 10 end setpixel x() y() c()");
    assert.deepEqual(result.output, [1, 2, 3]); assert.deepEqual([...result.memory.slice(0, 4)], [10, 10, 10, 255]);
  });
  check("RGB channels and alpha", () => assert.deepEqual([...run("setpixelrgb 1 0 10 20 30").memory.slice(4, 8)], [10, 20, 30, 255]));
  check("pixel bounds ignore row spill and negative coordinates", () => assert.ok(run("setpixelrgb 100 0 1 2 3 setpixel -1 0 99 setpixel 0 100 88").memory.every(v => v === 0)));
  check("canvas options remain independent between compilations", () => {
    const first = compile("setpixel 1 1 22", { width: 2, height: 2 });
    compile("", { width: 500, height: 500 });
    const instance = new WebAssembly.Instance(new WebAssembly.Module(first.slice().buffer), { env: { print_f32() {}, print_i32() {} } });
    (instance.exports.run as () => void)();
    assert.equal(new Uint8Array((instance.exports.memory as WebAssembly.Memory).buffer)[12], 22);
  });
  for (const [name, source, pattern] of [
    ["if end", "if (1) print 2", /Expected 'end'/],
    ["while end", "while (0) print 2", /Expected 'end'/],
    ["for end", "for i in 0..2 print i", /Expected 'end'/],
    ["function end", "fn f() return 2", /Expected 'end'/],
    ["missing argument comma", "fn f(x,y) return x end print f(1 2)", /Expected ','/],
    ["trailing argument comma", "fn f(x) return x end print f(1,)", /Unexpected token/],
    ["missing parameter comma", "fn f(x y) return x end", /Expected ','/],
    ["duplicate parameter", "fn f(x,x) return x end", /Duplicate parameter/],
    ["duplicate function", "fn f() return 1 end fn f() return 2 end", /Duplicate function/],
    ["duplicate local", "let x = 1 let x = 2", /Duplicate variable/],
    ["arity too few", "fn f(x) return x end print f()", /expects 1 arguments, got 0/],
    ["arity too many", "fn f(x) return x end print f(1,2)", /expects 1 arguments, got 2/],
    ["top level return", "return 1", /outside of function/],
    ["invalid range expression", "print (1 .. 2)", /Invalid expression operator/],
    ["undefined variable", "print x", /Undefined variable/],
    ["undefined function", "print f()", /Undefined function/],
    ["break outside loop", "break", /outside of loop/],
    ["continue outside loop", "continue", /outside of loop/],
  ] as const) check(`reject ${name}`, () => assert.throws(() => compile(source), pattern));
  check("call adjacency includes line number", () => {
    const ast = parse(tokenize("setpixel x\n          (1 + 2) 5"));
    assert.equal(ast[0].type, "setpixelStatement");
    if (ast[0].type === "setpixelStatement") assert.equal(ast[0].x.type, "identifier");
  });
  check("ordinary parenthesized grouping", () => assert.deepEqual(run("print ((3)) print -(5)").output, [3, -5]));
  for (const dimension of [0, -1, 501, 1.5, NaN, Infinity]) check(`reject canvas dimension ${dimension}`, () => assert.throws(() => compile("", { width: dimension }), /Canvas dimensions/));
  check("reject literals beyond finite f32 range", () => assert.throws(() => compile(`print ${"9".repeat(100)}`), /finite f32 range/));

  const tick = await runtime("setpixelrgb 0 0 255 0 0 setpixelrgb 1 0 0 255 0", { print() {} }, { width: 2, height: 1 });
  compile("", { width: 500, height: 500 }); tick();
  let rendered: Uint8ClampedArray = new Uint8ClampedArray();
  const canvas = { width: 0, height: 0, getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: (image: { data: Uint8ClampedArray }) => rendered = image.data }) };
  tick.renderToCanvas!(canvas as unknown as HTMLCanvasElement);
  check("runtime uses raw RGBA and captures dimensions", () => { assert.deepEqual([...rendered], [255, 0, 0, 255, 0, 255, 0, 255]); assert.equal(canvas.width, 2); assert.equal(canvas.height, 1); });

  for (const [name, example] of Object.entries(EXAMPLES)) check(`example ${name}`, () => {
    const result = run(example.code, { width: example.width ?? 100, height: example.height ?? 100 });
    const ast = parse(tokenize(example.code));
    const inspection = inspectBinary(result.bytes, ast.filter(n => n.type === "functionDeclaration").map(n => n.name));
    assert.equal(inspection.sections[inspection.sections.length - 1].end, result.bytes.length);
    for (const fn of inspection.functions) {
      assert.equal(fn.instructions[fn.instructions.length - 1].mnemonic, "end");
      for (let i = 1; i < fn.instructions.length; i++) assert.equal(fn.instructions[i - 1].end, fn.instructions[i].offset);
    }
  });
  check("instruction decoder links addition to byte 0x92", () => {
    const bytes = compile(LESSONS.arithmetic.code);
    const add = inspectBinary(bytes).functions[0].instructions.find(i => i.mnemonic === "f32.add")!;
    assert.equal(bytes[add.offset], 0x92); assert.equal(add.end - add.offset, 1);
  });

  const fixtures: { cases: { name: string; source: string; width?: number; height?: number; output?: number[]; memoryPrefix?: number[]; errorContains?: string }[] } = JSON.parse(fs.readFileSync(path.resolve("tests/conformance.json"), "utf8"));
  for (const fixture of fixtures.cases) check(`conformance: ${fixture.name}`, () => {
    if (fixture.errorContains) assert.throws(() => compile(fixture.source), error => error instanceof Error && error.message.includes(fixture.errorContains!));
    else {
      const result = run(fixture.source, { width: fixture.width ?? 100, height: fixture.height ?? 100 });
      assert.deepEqual(result.output, fixture.output);
      if (fixture.memoryPrefix) assert.deepEqual([...result.memory.slice(0, fixture.memoryPrefix.length)], fixture.memoryPrefix);
    }
  });

  // Exercise the same worker source with a small Node bridge for browser postMessage.
  const workerPath = path.resolve("playground/runner.worker.ts");
  const shim = `const { parentPort } = require('node:worker_threads'); global.self = { postMessage: m => parentPort.postMessage(m) }; require('ts-node/register'); require(${JSON.stringify(workerPath)}); parentPort.on('message', data => self.onmessage({data})); parentPort.postMessage({type:'ready'});`;
  const inWorker = (request: WorkerRequest, onMessage: (message: WorkerResponse, worker: Worker, done: () => void) => void) => new Promise<void>((resolve, reject) => {
    const worker = new Worker(shim, { eval: true });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("Worker integration test timed out")); }, 15000);
    const done = () => { clearTimeout(timer); void worker.terminate(); resolve(); };
    worker.on("error", error => { clearTimeout(timer); reject(error); });
    worker.on("message", message => {
      if (message.type === "ready") worker.postMessage(request);
      else try { onMessage(message, worker, done); } catch (error) { clearTimeout(timer); void worker.terminate(); reject(error); }
    });
  });
  let lines = 0, capped = false;
  await inWorker({ source: "for i in 0..1100 print i end", width: 1, height: 1, execute: true }, (message, _, done) => {
    if (message.type === "error") throw new Error(message.message);
    if (message.type === "output") { lines += message.values.length; capped ||= !!message.truncated; }
    if (message.type === "complete") { assert.equal(lines, MAX_OUTPUT_LINES); assert.ok(capped); done(); }
  }); checks++; console.log("PASS worker caps output and completes");
  await inWorker({ source: "while (1) end", width: 1, height: 1, execute: true }, (message, _, done) => {
    if (message.type === "error") throw new Error(message.message);
    if (message.type === "compiled") setTimeout(done, 100);
    if (message.type === "complete") throw new Error("Infinite loop returned");
  }); checks++; console.log("PASS worker can be terminated during infinite WASM execution");
  await inWorker({ source: "while (1) end", width: 1, height: 1, execute: false }, (message, _, done) => {
    if (message.type === "compiled") done();
    if (message.type === "error") throw new Error(message.message);
    if (message.type === "complete") throw new Error("Compile-only request executed source");
  }); checks++; console.log("PASS compile-only worker does not execute source");
  console.log(`\n${checks} regression, example, inspector, and worker checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
