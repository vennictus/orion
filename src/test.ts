import { compile } from "./compiler";

/**
 * Runs a single Orion program and captures printed output
 */
async function runProgram(source: string): Promise<number[]> {
  const output: number[] = [];

  // Compile source → WASM bytes
  const wasm = compile(source);

  // IMPORTANT: force real ArrayBuffer (you already learned this the hard way)
  const buffer = wasm.slice().buffer;

  const result = await WebAssembly.instantiate(buffer, {
  env: {
    print_f32: (v: number) => output.push(v),
    print_i32: (v: number) => output.push(v),
  },
});


  const instance = result.instance;

  // Execute compiled program
  (instance.exports.run as Function)();

  return output;
}

/**
 * Simple assertion helper
 */
function assertEqual(
  name: string,
  actual: number[],
  expected: number[]
) {
  const pass =
    actual.length === expected.length &&
    actual.every((v, i) => v === expected[i]);

  if (!pass) {
    throw new Error(
      `❌ ${name}\nExpected: ${JSON.stringify(expected)}\nGot:      ${JSON.stringify(actual)}`
    );
  }

  console.log(`✅ ${name}`);
}

/**
 * All tests for current Orion feature set
 */
async function runTests() {
  console.log("🚀 Running Orion tests...\n");

  await assertTest(
    "print single number",
    "print 8",
    [8]
  );

  await assertTest(
    "multiple print statements",
    "print 8 print 24",
    [8, 24]
  );

  await assertTest(
    "simple binary addition",
    "print (2+4)",
    [6]
  );

  await assertTest(
    "subtraction",
    "print (10-3)",
    [7]
  );

  await assertTest(
    "multiplication",
    "print (3*5)",
    [15]
  );

  await assertTest(
    "division",
    "print (20/4)",
    [5]
  );

  await assertTest(
    "nested binary expression",
    "print ((6-4)+10)",
    [12]
  );

  await assertTest(
    "deeply nested expression",
    "print (((2+3)*(4+1))-5)",
    [20]
  );

  await assertTest(
    "equality comparison",
    "print (4==4)",
    [1]
  );

  await assertTest(
    "less-than comparison",
    "print (3<5)",
    [1]
  );

  await assertTest(
    "greater-than comparison",
    "print (10>20)",
    [0]
  );

  await assertTest(
    "logical AND",
    "print (1&&0)",
    [0]
  );

  await assertTest(
    "logical AND with comparisons",
    "print ((2>1)&&(3<4))",
    [1]
  );

  await assertTest(
    "evaluation order & stack discipline",
    "print ((1+2)*(3+4)) print (5+6)",
    [21, 11]
  );

  console.log("\n🎉 All Orion tests passed");
}

/**
 * Wrapper so each test reports its own name
 */
async function assertTest(
  name: string,
  source: string,
  expected: number[]
) {
  const output = await runProgram(source);
  assertEqual(name, output, expected);
}

// Run
runTests().catch(err => {
  console.error("\n💥 Test failure");
  console.error(err.message);
  process.exit(1);
});
