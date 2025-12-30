import { compile } from "./compiler";

/**
 * Runs a single Astra program and captures printed output
 */
async function runProgram(source: string): Promise<number[]> {
  const output: number[] = [];

  // Compile source → WASM bytes
  const wasm = compile(source);

  // Force real ArrayBuffer (avoid SharedArrayBuffer issues)
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

/**
 * All tests for current Astra + Orion feature set
 */
async function runTests() {
  console.log("🚀 Running Astra tests...\n");

  // ----- BASICS -----
  await assertTest("print single number", "print 8", [8]);
  await assertTest("multiple print statements", "print 8 print 24", [8, 24]);

  // ----- ARITHMETIC -----
  await assertTest("simple addition", "print (2+4)", [6]);
  await assertTest("subtraction", "print (10-3)", [7]);
  await assertTest("multiplication", "print (3*5)", [15]);
  await assertTest("division", "print (20/4)", [5]);

  // ----- NESTING -----
  await assertTest("nested expression", "print ((6-4)+10)", [12]);
  await assertTest("deep nesting", "print (((2+3)*(4+1))-5)", [20]);

  // ----- COMPARISONS -----
  await assertTest("equality", "print (4==4)", [1]);
  await assertTest("less-than", "print (3<5)", [1]);
  await assertTest("greater-than", "print (10>20)", [0]);

  // ----- LOGICAL -----
  await assertTest("logical AND", "print (1&&0)", [0]);
  await assertTest(
    "logical AND with comparisons",
    "print ((2>1)&&(3<4))",
    [1]
  );

  // ----- STACK DISCIPLINE -----
  await assertTest(
    "evaluation order",
    "print ((1+2)*(3+4)) print (5+6)",
    [21, 11]
  );

  // ----- VARIABLES -----
  await assertTest(
    "variable declaration",
    "let x = 10 print x",
    [10]
  );

  await assertTest(
    "variable in expression",
    "let x = 10 print (x+5)",
    [15]
  );

  await assertTest(
    "multiple variables",
    "let x = 3 let y = 4 print (x*y)",
    [12]
  );

  await assertTest(
    "variable reuse",
    "let x = 7 print x print (x+1) print (x*2)",
    [7, 8, 14]
  );

  await assertTest(
    "variables with comparisons",
    "let x = 5 let y = 10 print (x<y) print (x==y)",
    [1, 0]
  );

  await assertTest(
    "variables with logical AND",
    "let a = 1 let b = 0 print (a&&b)",
    [0]
  );

  await assertTest(
    "nested expressions with variables",
    "let x = 2 let y = 3 print ((x+1)*(y+2))",
    [15]
  );

  console.log("\n🎉 All Astra tests passed");
}

// Run
runTests().catch(err => {
  console.error("\n💥 Test failure");
  console.error(err.message);
  process.exit(1);
});
