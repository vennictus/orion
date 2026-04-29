import { compile } from "../src/compiler";
import { parse } from "../src/parser";
import { tokenize } from "../src/tokenizer";

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

function assertTokenValues(name: string, source: string, expected: string[]) {
  const actual = tokenize(source).map((token) => token.value);
  const ok =
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);

  if (!ok) {
    throw new Error(
      `❌ ${name}\nExpected: ${JSON.stringify(expected)}\nGot:      ${JSON.stringify(actual)}`
    );
  }

  console.log(`✅ ${name}`);
}

function assertThrows(name: string, fn: () => void, messagePart: string) {
  try {
    fn();
  } catch (err: any) {
    if (String(err.message).includes(messagePart)) {
      console.log(`✅ ${name}`);
      return;
    }

    throw new Error(
      `❌ ${name}\nExpected error containing: ${messagePart}\nGot: ${err.message}`
    );
  }

  throw new Error(`❌ ${name}\nExpected function to throw`);
}

async function test(name: string, source: string, expected: number[]) {
  const out = await runProgram(source);
  assertEqual(name, out, expected);
}

/* ---------- TEST SUITE ---------- */

async function run() {
  console.log("Astra torture test suite\n");

  /* ===== TOKENIZER / PARSER ===== */
  assertTokenValues("tokenizer skips comments", "let x = 1 // ignored\nprint x", [
    "let",
    "x",
    "=",
    "1",
    "print",
    "x",
  ]);

  assertTokenValues("keyword prefixes remain identifiers", "let letter = 2", [
    "let",
    "letter",
    "=",
    "2",
  ]);

  assertThrows("tokenizer reports source location", () => tokenize("let x = @"), "line 1, column 9");

  assertThrows(
    "parser reports missing paren location",
    () => parse(tokenize("print (1 + 2")),
    "Expected ')'"
  );

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

  await test(
    "mixed i32 and f32 locals",
    `
      let whole = 3
      let frac = 2.5
      print (whole + frac)
      print whole
    `,
    [5.5, 3]
  );

  await test(
    "assignment converts to declared local type",
    `
      let whole = 1
      whole = 2.9
      print whole

      let frac = 1.5
      frac = 2
      print frac
    `,
    [2, 2]
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

    // RGBA format: each pixel is 4 bytes (R,G,B,A)
    // pixel (0,0) -> value 0 -> offset 0*4 = 0
    assertMemoryByte("pixel (0,0)", memory, 0, 0);      // R=0
    // pixel (1,0) -> value 1 -> offset 1*4 = 4
    assertMemoryByte("pixel (1,0)", memory, 4, 1);      // R=1
    // pixel (2,0) -> value 2 -> offset 2*4 = 8
    assertMemoryByte("pixel (2,0)", memory, 8, 2);      // R=2

    // pixel (0,1) -> offset (0 + 1*100)*4 = 400, value = 1
    assertMemoryByte("pixel (0,1)", memory, 400, 1);
    // pixel (1,1) -> offset (1 + 1*100)*4 = 404, value = 2
    assertMemoryByte("pixel (1,1)", memory, 404, 2);
    // pixel (2,1) -> offset (2 + 1*100)*4 = 408, value = 3
    assertMemoryByte("pixel (2,1)", memory, 408, 3);
  }

  console.log("\n🎉 ALL V1 TESTS PASSED\n");

  /* ===== PHASE 2 TESTS ===== */
  
  // New comparison operators
  await test("not-equal true", "print (4 != 5)", [1]);
  await test("not-equal false", "print (5 != 5)", [0]);
  await test("less-or-equal true", "print (3 <= 3)", [1]);
  await test("less-or-equal false", "print (4 <= 3)", [0]);
  await test("greater-or-equal true", "print (5 >= 5)", [1]);
  await test("greater-or-equal false", "print (3 >= 5)", [0]);
  await test("logical OR true-false", "print (1 || 0)", [1]);
  await test("logical OR false-true", "print (0 || 1)", [1]);
  await test("logical OR false-false", "print (0 || 0)", [0]);

  // Unary negation
  await test("unary negation", "print -5", [-5]);
  await test("unary negation expr", "print -(3 + 2)", [-5]);

  // Not operator
  await test("not true", "print not 1", [0]);
  await test("not false", "print not 0", [1]);

  // For loop
  {
    const out = await runProgram(`
      for i in 0..3
        print i
      end
    `);
    assertEqual("for loop", out, [0, 1, 2]);
  }

  console.log("🎉 ALL PHASE 2 TESTS PASSED\n");

  /* ===== PHASE 3 TESTS: FUNCTIONS ===== */

  // Simple function
  {
    const out = await runProgram(`
      fn double(x)
        return (x * 2)
      end
      
      print double(5)
    `);
    assertEqual("simple function", out, [10]);
  }

  // Function with multiple params
  {
    const out = await runProgram(`
      fn add(a, b)
        return (a + b)
      end
      
      print add(3, 7)
    `);
    assertEqual("function with two params", out, [10]);
  }

  // Multiple function calls
  {
    const out = await runProgram(`
      fn square(x)
        return (x * x)
      end
      
      print square(3)
      print square(4)
    `);
    assertEqual("multiple function calls", out, [9, 16]);
  }

  // Nested function calls
  {
    const out = await runProgram(`
      fn double(x)
        return (x * 2)
      end
      
      fn quadruple(x)
        return double(double(x))
      end
      
      print quadruple(3)
    `);
    assertEqual("nested function calls", out, [12]);
  }

  // Recursive function (factorial)
  {
    const out = await runProgram(`
      fn factorial(n)
        if (n <= 1)
          return 1
        end
        return (n * factorial((n - 1)))
      end
      
      print factorial(5)
    `);
    assertEqual("recursive factorial", out, [120]);
  }

  console.log("🎉 ALL PHASE 3 TESTS PASSED\n");
  console.log("✅ ALL TESTS PASSED");
}

run().catch(err => {
  console.error("\n💥 TEST FAILURE");
  console.error(err.message);
  process.exit(1);
});
