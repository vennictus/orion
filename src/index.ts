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

  /* ===== SCOPE ===== */
  await test(
    "shadowing",
    `
      let x = 2
      {
        let x = 10
        print x
      }
      print x
    `,
    [10, 2]
  );

  await test(
    "nested scopes",
    `
      let x = 1
      {
        let y = 2
        {
          let x = 3
          print (x+y)
        }
        print x
      }
      print x
    `,
    [5, 1, 1]
  );

  /* ===== IF / ELSE ===== */
  await test(
    "if true branch",
    `
      if (1)
        print 10
      end
    `,
    [10]
  );

  await test(
    "if false branch",
    `
      if (0)
        print 10
      end
    `,
    []
  );

  await test(
    "if else true",
    `
      if (1)
        print 1
      else
        print 2
      end
    `,
    [1]
  );

  await test(
    "if else false",
    `
      if (0)
        print 1
      else
        print 2
      end
    `,
    [2]
  );

  /* =========================================================
     🔬 WHILE — DIAGNOSTIC TESTS (THIS IS THE POINT)
     ========================================================= */

  await test(
    "while false, empty body",
    `
      while (0)
      end
      print 99
    `,
    [99]
  );

  await test(
    "while true, empty body",
    `
      while (1)
      end
      print 42
    `,
    [42]
  );

  await test(
    "while condition consumed",
    `
      print 1
      while (0)
      end
      print 2
    `,
    [1, 2]
  );

  await test(
    "variable intact after false loop",
    `
      let x = 7
      while (0)
        print x
      end
      print x
    `,
    [7]
  );

  await test(
    "mutation skipped when loop false",
    `
      let x = 5
      while (0)
        x = 99
      end
      print x
    `,
    [5]
  );

  await test(
    "simple while loop",
    `
      let x = 0
      while (x < 3)
        print x
        x = (x + 1)
      end
    `,
    [0, 1, 2]
  );

  await test(
    "while false with sentinel",
    `
      let x = 10
      print 111
      while (x < 5)
        print 222
      end
      print 333
    `,
    [111, 333]
  );

  await test(
    "nested while",
    `
      let i = 0
      while (i < 2)
        let j = 0
        while (j < 2)
          print (i + j)
          j = (j + 1)
        end
        i = (i + 1)
      end
    `,
    [0, 1, 1, 2]
  );

  

  await test(
    "break exits loop immediately",
    `
      let x = 0
      while (1)
        print x
        break
        print 999
      end
      print 42
    `,
    [0, 42]
  );

  await test(
    "continue skips rest of iteration",
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

  await test(
    "break inside conditional",
    `
      let x = 0
      while (x < 5)
        if (x == 2)
          break
        end
        print x
        x = (x + 1)
      end
    `,
    [0, 1]
  );

  await test(
    "continue inside conditional",
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

  await test(
    "nested loop break only exits inner loop",
    `
      let i = 0
      while (i < 2)
        let j = 0
        while (j < 5)
          print (i + j)
          break
        end
        i = (i + 1)
      end
    `,
    [0, 1]
  );

  await test(
    "nested loop continue only affects inner loop",
    `
      let i = 0
      while (i < 2)
        let j = 0
        while (j < 3)
          j = (j + 1)
          if (j == 2)
            continue
          end
          print (i + j)
        end
        i = (i + 1)
      end
    `,
    [1, 3, 2, 4]
  );

  await test(
    "break in nested loop does not kill outer loop",
    `
      let i = 0
      while (i < 3)
        let j = 0
        while (1)
          print i
          break
        end
        i = (i + 1)
      end
    `,
    [0, 1, 2]
  );

  await test(
    "continue at top of loop",
    `
      let x = 0
      while (x < 3)
        x = (x + 1)
        continue
      end
      print x
    `,
    [3]
  );


  console.log("\n🎉 All Astra tests passed");
}

run().catch(err => {
  console.error("\n💥 TEST FAILURE");
  console.error(err.message);
  process.exit(1);
});
