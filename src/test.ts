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

function assertEqual(name: string, actual: number[], expected: number[]) {
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

async function test(name: string, source: string, expected: number[]) {
  const out = await runProgram(source);
  assertEqual(name, out, expected);
}

/* ---------- TEST SUITE ---------- */

async function run() {
  console.log("🚀 Astra torture test suite\n");

  /* ===== CORE ===== */
  await test("single print", "print 5", [5]);
  await test("multiple prints", "print 1 print 2 print 3", [1, 2, 3]);

  /* ===== ARITHMETIC ===== */
  await test("addition", "print (2+3)", [5]);
  await test("subtraction", "print (10-4)", [6]);
  await test("multiplication", "print (3*4)", [12]);
  await test("division", "print (20/5)", [4]);

  await test(
    "nested arithmetic stack order",
    "print ((2+3)*(4+1)) print (6/(2+1))",
    [25, 2]
  );

  /* ===== COMPARISONS ===== */
  await test("equals true", "print (4==4)", [1]);
  await test("equals false", "print (4==5)", [0]);
  await test("less-than", "print (3<5)", [1]);
  await test("greater-than", "print (7>10)", [0]);

  /* ===== LOGICAL ===== */
  await test("logical AND false", "print (1&&0)", [0]);
  await test("logical AND true", "print ((2>1)&&(3<4))", [1]);

  /* ===== VARIABLES ===== */
  await test(
    "variable shadowing",
    `
      let x = 1
      {
        let x = 10
        print x
      }
      print x
    `,
    [10, 1]
  );

  await test(
    "deep scope isolation",
    `
      let a = 1
      {
        let b = 2
        {
          let c = 3
          print ((a+b)+c)
        }
        print a
      }
      print a
    `,
    [6, 1, 1]
  );

  /* ===== IF / ELSE ===== */
  await test(
    "if false branch skipped",
    `
      if (0)
        print 999
      else
        print 42
      end
    `,
    [42]
  );

  await test(
    "nested if",
    `
      let x = 1
      if (x)
        if (1)
          print 7
        end
      end
    `,
    [7]
  );

  /* ===== WHILE ===== */
  await test(
    "while false body never executes",
    `
      let x = 0
      while (0)
        x = 99
      end
      print x
    `,
    [0]
  );

  await test(
    "while consumes condition correctly",
    `
      print 1
      while (0)
      end
      print 2
    `,
    [1, 2]
  );

  /* ===== BREAK / CONTINUE ===== */
  await test(
    "break exits only inner loop",
    `
      let i = 0
      while (i < 2)
        let j = 0
        while (1)
          print i
          break
        end
        i = (i + 1)
      end
    `,
    [0, 1]
  );

  await test(
    "continue skips rest of iteration",
    `
      let x = 0
      while (x < 5)
        x = (x + 1)
        if (x == 3)
          continue
        end
        print x
      end
    `,
    [1, 2, 4, 5]
  );

  /* ===== MEMORY ===== */
  {
    const { memory } = await runProgramWithMemory(`
      let y = 0
      while (y < 3)
        let x = 0
        while (x < 3)
          setpixel x y (x + y)
          x = (x + 1)
        end
        y = (y + 1)
      end
    `);

    assertMemoryByte("pixel (0,0)", memory, 0, 0);
    assertMemoryByte("pixel (1,0)", memory, 1, 1);
    assertMemoryByte("pixel (2,0)", memory, 2, 2);

    assertMemoryByte("pixel (0,1)", memory, 100, 1);
    assertMemoryByte("pixel (1,1)", memory, 101, 2);
    assertMemoryByte("pixel (2,1)", memory, 102, 3);
  }

  console.log("\n🎉 ALL PRE-FUNCTION TESTS PASSED");
}

run().catch(err => {
  console.error("\n💥 TEST FAILURE");
  console.error(err.message);
  process.exit(1);
});
