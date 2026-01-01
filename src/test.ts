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

  /* ===== NESTING ===== */
  await test(
    "nested arithmetic",
    "print ((2+3)*(4+1))",
    [25]
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
    "simple variable",
    "let x = 10 print x",
    [10]
  );

  await test(
    "variable in expression",
    "let x = 4 print (x+6)",
    [10]
  );

  await test(
    "multiple variables",
    "let a = 3 let b = 5 print (a*b)",
    [15]
  );

  /* ===== REASSIGNMENT ===== */
  await test(
    "reassignment",
    "let x = 5 x = (x+2) print x",
    [7]
  );

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
    "if false branch (no else)",
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

  await test(
    "if with comparison",
    `
      if (3 < 5)
        print 7
      else
        print 9
      end
    `,
    [7]
  );

  await test(
    "if with variables",
    `
      let x = 4
      if (x == 4)
        print (x+1)
      else
        print 0
      end
    `,
    [5]
  );

  await test(
    "if scope isolation",
    `
      let x = 1
      if (1)
        let x = 10
        print x
      end
      print x
    `,
    [10, 1]
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
  "while with false condition",
  `
    let x = 10
    while (x < 5)
      print x
    end
    print 99
  `,
  [99]
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
  [0,1,1,2]
);


  /* ===== STACK DISCIPLINE ===== */
  await test(
    "evaluation order",
    "print ((1+2)*(3+4)) print (5+6)",
    [21, 11]
  );

  console.log("\n🎉 All Astra tests passed");
}

run().catch(err => {
  console.error("\n💥 TEST FAILURE");
  console.error(err.message);
  process.exit(1);
});
