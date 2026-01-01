import { compile } from "../src/compiler";

/**
 * Runs a single Astra program and captures printed output
 */
async function runProgram(source: string): Promise<number[]> {
  const output: number[] = [];

  const wasm = compile(source);
  const buffer = wasm.slice().buffer;

  const { instance } = await WebAssembly.instantiate(buffer, {
    env: {
      print_f32: (v: number) => output.push(v),
      print_i32: (v: number) => output.push(v),
    },
  });

  (instance.exports.run as Function)();
  return output;
}

/**
 * Runs a program and returns both printed output and memory
 */
async function runProgramWithMemory(source: string) {
  const output: number[] = [];

  const wasm = compile(source);
  const buffer = wasm.slice().buffer;

  const { instance } = await WebAssembly.instantiate(buffer, {
    env: {
      print_f32: (v: number) => output.push(v),
      print_i32: (v: number) => output.push(v),
    },
  });

  const memory = instance.exports.memory as WebAssembly.Memory;
  if (!memory) {
    throw new Error("WASM memory not exported");
  }

  const mem = new Uint8Array(memory.buffer);

  (instance.exports.run as Function)();

  return {
    output,
    memory: mem,
  };
}

/* ---------- ASSERT HELPERS ---------- */

function assertEqual(
  name: string,
  actual: number[],
  expected: number[]
) {
  const ok =
    actual.length === expected.length &&
    actual.every((v, i) => v === expected[i]);

  if (!ok) {
    throw new Error(
      `❌ ${name}\nExpected: ${JSON.stringify(expected)}\nGot:      ${JSON.stringify(actual)}`
    );
  }

  console.log(`✅ ${name}`);
}

function assertMemoryByte(
  name: string,
  memory: Uint8Array,
  index: number,
  expected: number
) {
  if (memory[index] !== expected) {
    throw new Error(
      `❌ ${name}\nExpected memory[${index}] = ${expected}\nGot ${memory[index]}`
    );
  }

  console.log(`✅ ${name}`);
}

async function test(
  name: string,
  source: string,
  expected: number[]
) {
  const out = await runProgram(source);
  assertEqual(name, out, expected);
}

/* ---------- TEST SUITE ---------- */

async function run() {
  console.log("🚀 Astra test suite\n");

  /* ===== CORE ===== */
  await test("single print", "print 5", [5]);
  await test("multiple prints", "print 1 print 2 print 3", [1, 2, 3]);

  /* ===== ARITHMETIC ===== */
  await test("addition", "print (2+3)", [5]);
  await test("subtraction", "print (10-4)", [6]);
  await test("multiplication", "print (3*4)", [12]);
  await test("division", "print (20/5)", [4]);

  /* ===== COMPARISONS ===== */
  await test("equals true", "print (4==4)", [1]);
  await test("equals false", "print (4==5)", [0]);
  await test("less-than", "print (3<5)", [1]);
  await test("greater-than", "print (7>10)", [0]);

  /* ===== LOGICAL ===== */
  await test("logical AND false", "print (1&&0)", [0]);
  await test("logical AND true", "print ((2>1)&&(3<4))", [1]);

  /* ===== VARIABLES ===== */
  await test("simple variable", "let x = 10 print x", [10]);
  await test("variable in expression", "let x = 4 print (x+6)", [10]);
  await test("multiple variables", "let a = 3 let b = 5 print (a*b)", [15]);

  /* ===== REASSIGNMENT ===== */
  await test("reassignment", "let x = 5 x = (x+2) print x", [7]);

  /* ===== IF / ELSE ===== */
  await test(
    "if else",
    `
      let x = 1
      if (x)
        print 10
      else
        print 20
      end
    `,
    [10]
  );

  /* ===== WHILE ===== */
  await test(
    "simple while",
    `
      let x = 0
      while (x < 3)
        print x
        x = (x + 1)
      end
    `,
    [0, 1, 2]
  );

  /* ===== BREAK / CONTINUE ===== */
  await test(
    "break",
    `
      let x = 0
      while (1)
        print x
        break
      end
    `,
    [0]
  );

  await test(
    "continue",
    `
      let x = 0
      while (x < 3)
        x = (x + 1)
        continue
        print 999
      end
      print x
    `,
    [3]
  );

  /* ===== MEMORY ===== */
  {
    const { memory } = await runProgramWithMemory(`
      let y = 0
      while (y < 3)
        let x = 0
        while (x < 3)
          setpixel x y 255
          x = (x + 1)
        end
        y = (y + 1)
      end
    `);

    // row 0
    assertMemoryByte("pixel (0,0)", memory, 0, 255);
    assertMemoryByte("pixel (1,0)", memory, 1, 255);
    assertMemoryByte("pixel (2,0)", memory, 2, 255);

    // row 1 (WIDTH = 100)
    assertMemoryByte("pixel (0,1)", memory, 100, 255);
    assertMemoryByte("pixel (1,1)", memory, 101, 255);
    assertMemoryByte("pixel (2,1)", memory, 102, 255);
  }

  console.log("\n🎉 All Astra tests passed");
}

run().catch(err => {
  console.error("\n💥 TEST FAILURE");
  console.error(err.message);
  process.exit(1);
});
