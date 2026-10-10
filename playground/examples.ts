export interface Example {
  name: string;
  description?: string;
  lesson?: { title: string; text: string; tab: "tokens" | "ast" | "instructions" | "bytes" }[];
  code: string;
  width?: number;
  height?: number;
}

interface ExampleGroup {
  label: string;
  items: Record<string, Example>;
}

export const EXAMPLE_GROUPS: ExampleGroup[] = [
  {
    label: 'Fractals',
    items: {
      mandelbrot: {
        name: 'Mandelbrot Set',
        description: 'A fractal, computed pixel by pixel in WebAssembly.',
        code: `// Mandelbrot. Every pixel is computed by the WASM program.
for y in 0..180
  for x in 0..240
    let cx = (((x / 240) * 3.5) - 2.5)
    let cy = (((y / 180) * 2.6) - 1.3)
    let zx = 0
    let zy = 0
    let i = 0
    while (i < 160)
      let zx2 = (zx * zx)
      let zy2 = (zy * zy)
      if ((zx2 + zy2) > 4)
        break
      end
      zy = (((2 * zx) * zy) + cy)
      zx = ((zx2 - zy2) + cx)
      i = (i + 1)
    end
    if (i == 160)
      setpixelrgb x y 16 19 35
    else
      let band = i
      while (band >= 48)
        band = (band - 48)
      end
      setpixelrgb x y (38 + (band * 4)) (90 + (band * 3)) (175 + band)
    end
  end
end`,
        width: 240,
        height: 180,
      },
      julia: {
        name: 'Julia Set',
        code: `// Julia Set Fractal
let cReal = -0.7
let cImag = 0.27015

let y = 0
while (y < 100)
  let x = 0
  while (x < 100)
    let zx = (((x / 100) * 3.0) - 1.5)
    let zy = (((y / 100) * 3.0) - 1.5)
    let i = 0

    while (i < 255)
      let zx2 = (zx * zx)
      let zy2 = (zy * zy)
      if ((zx2 + zy2) > 4)
        break
      end
      let newZx = ((zx2 - zy2) + cReal)
      let newZy = (((2 * zx) * zy) + cImag)
      zx = newZx
      zy = newZy
      i = (i + 1)
    end

    // Purple to gold gradient
    let r = (i + 50)
    let g = (i / 2)
    let b = (200 - i)
    setpixelrgb x y r g b
    x = (x + 1)
  end
  y = (y + 1)
end`,
        width: 100,
        height: 100,
      },
      burningship: {
        name: 'Burning Ship',
        code: `// Burning Ship Fractal
let y = 0
while (y < 100)
  let x = 0
  while (x < 100)
    let cx = (((x / 100) * 3.5) - 2.5)
    let cy = (((y / 100) * 2.5) - 1.8)
    let zx = 0
    let zy = 0
    let i = 0

    while (i < 255)
      let zx2 = (zx * zx)
      let zy2 = (zy * zy)
      if ((zx2 + zy2) > 4)
        break
      end
      // Absolute value trick for burning ship
      let absZx = zx
      let absZy = zy
      if (zx < 0)
        absZx = (0 - zx)
      end
      if (zy < 0)
        absZy = (0 - zy)
      end
      let newZx = ((zx2 - zy2) + cx)
      let newZy = (((2 * absZx) * absZy) + cy)
      zx = newZx
      zy = newZy
      i = (i + 1)
    end

    // Fire colors
    let r = i
    let g = (i / 3)
    let b = 0
    setpixelrgb x y r g b
    x = (x + 1)
  end
  y = (y + 1)
end`,
        width: 100,
        height: 100,
      },
    },
  },
  {
    label: 'Patterns',
    items: {
      gradient: {
        name: 'Rainbow Gradient',
        code: `// Rainbow Diagonal Gradient
for y in 0..100
  for x in 0..100
    let t = ((x + y) / 2)
    // Rainbow colors
    let r = (128 + (t * 1.2))
    let g = (64 + t)
    let b = (255 - t)
    setpixelrgb x y r g b
  end
end`,
        width: 100,
        height: 100,
      },
      checkerboard: {
        name: 'Checkerboard',
        code: `// Checkerboard Pattern
for y in 0..100
  for x in 0..100
    let cellX = 0
    let tx = x
    while (tx >= 10)
      tx = (tx - 10)
      cellX = (cellX + 1)
    end

    let cellY = 0
    let ty = y
    while (ty >= 10)
      ty = (ty - 10)
      cellY = (cellY + 1)
    end

    let sum = (cellX + cellY)
    let isEven = 1
    while (sum > 0)
      isEven = (1 - isEven)
      sum = (sum - 1)
    end

    if (isEven)
      setpixelrgb x y 249 115 22   // Orange
    else
      setpixelrgb x y 251 191 36   // Gold
    end
  end
end`,
        width: 100,
        height: 100,
      },
      stripes: {
        name: 'Diagonal Stripes',
        code: `// Diagonal Stripes
for y in 0..100
  for x in 0..100
    let sum = (x + y)
    let band = 0
    while (sum >= 10)
      sum = (sum - 10)
      band = (band + 1)
    end

    let isEven = 1
    while (band > 0)
      isEven = (1 - isEven)
      band = (band - 1)
    end

    if (isEven)
      setpixelrgb x y 34 211 153   // Mint
    else
      setpixelrgb x y 20 30 48     // Dark blue
    end
  end
end`,
        width: 100,
        height: 100,
      },
      plasma: {
        name: 'Plasma Effect',
        code: `// Plasma Effect
for y in 0..100
  for x in 0..100
    // Simplified plasma using sin approximation
    let v1 = (x + y)
    let v2 = ((x * x) + (y * y))
    let v3 = (x - y)

    let r = ((v1 * 2) + 128)
    let g = ((v2 / 50) + 64)
    let b = ((v3 * 3) + 128)

    setpixelrgb x y r g b
  end
end`,
        width: 100,
        height: 100,
      },
    },
  },
  {
    label: 'Shapes',
    items: {
      circles: {
        name: 'Concentric Circles',
        code: `// Concentric Circles
fn distance(x1, y1, x2, y2)
  let dx = (x1 - x2)
  let dy = (y1 - y2)
  return ((dx * dx) + (dy * dy))
end

let cx = 50
let cy = 50

for y in 0..100
  for x in 0..100
    let dist = distance(x, y, cx, cy)
    let ring = 0
    while (dist >= 400)
      dist = (dist - 400)
      ring = (ring + 1)
    end

    let isEven = 1
    while (ring > 0)
      isEven = (1 - isEven)
      ring = (ring - 1)
    end

    if (isEven)
      setpixelrgb x y 249 115 22   // Orange
    else
      setpixelrgb x y 15 20 30     // Dark
    end
  end
end`,
        width: 100,
        height: 100,
      },
      sierpinski: {
        name: 'Sierpinski Triangle',
        code: `// Sierpinski Triangle using XOR rule
for y in 0..128
  for x in 0..128
    // Bitwise AND simulation using modulo
    let tx = x
    let ty = y
    let isHole = 0

    while (tx > 0)
      // Divide by 2 with explicit truncation
      let rx = 0
      let xRest = tx
      while (xRest >= 2)
        xRest = (xRest - 2)
        rx = (rx + 1)
      end

      let ry = 0
      let yRest = ty
      while (yRest >= 2)
        yRest = (yRest - 2)
        ry = (ry + 1)
      end

      let bx = (tx - (rx * 2))
      let by = (ty - (ry * 2))

      if ((bx > 0) && (by > 0))
        isHole = 1
      end

      tx = rx
      ty = ry
    end

    if (isHole == 0)
      setpixelrgb x y 251 191 36   // Gold
    else
      setpixelrgb x y 10 12 20     // Dark
    end
  end
end`,
        width: 128,
        height: 128,
      },
      crosshatch: {
        name: 'Crosshatch',
        code: `// Crosshatch Pattern
for y in 0..100
  for x in 0..100
    let rx = x
    while (rx >= 8)
      rx = (rx - 8)
    end

    let ry = y
    while (ry >= 8)
      ry = (ry - 8)
    end

    if ((rx < 2) || (ry < 2))
      setpixelrgb x y 249 115 22   // Orange lines
    else
      setpixelrgb x y 20 25 40     // Dark bg
    end
  end
end`,
        width: 100,
        height: 100,
      },
    },
  },
  {
    label: 'Functions',
    items: {
      functions: {
        name: 'Functions Demo',
        code: `// Functions Demo
fn square(x)
  return (x * x)
end

fn max(a, b)
  if (a > b)
    return a
  end
  return b
end

fn clamp(val, lo, hi)
  if (val < lo)
    return lo
  end
  if (val > hi)
    return hi
  end
  return val
end

// Draw radial gradient with functions
for y in 0..100
  for x in 0..100
    let dx = (x - 50)
    let dy = (y - 50)
    let dist = (square(dx) + square(dy))
    let c = clamp((dist / 10), 0, 255)
    let r = c
    let g = (c / 2)
    let b = (255 - c)
    setpixelrgb x y r g b
  end
end

print square(7)
print max(42, 17)`,
        width: 100,
        height: 100,
      },
      recursive: {
        name: 'Recursive Factorial',
        code: `// Recursive Functions
fn factorial(n)
  if (n <= 1)
    return 1
  end
  return (n * factorial((n - 1)))
end

fn fib(n)
  if (n <= 1)
    return n
  end
  return (fib((n - 1)) + fib((n - 2)))
end

// Print factorials
print factorial(5)
print factorial(6)
print factorial(7)

// Print fibonacci
print fib(10)
print fib(12)

// Simple visualization
for y in 0..50
  for x in 0..100
    let v = ((x + y) * 2)
    setpixelrgb x y v (v / 2) (100 - v)
  end
end`,
        width: 100,
        height: 50,
      },
    },
  },
];


export const LESSONS: Record<string, Example> = {
  arithmetic: {
    name: "An expression becomes bytes",
    description: "Follow a single addition from source to the WASM stack.",
    code: `// Two constants, one addition, one host call.
print (2 + 3)`,
    lesson: [
      { title: "Source becomes tokens", text: "The lexer keeps the words and punctuation, skips this comment, and records each token’s line and column. Click a token to find it in the editor.", tab: "tokens" },
      { title: "Tokens become a tree", text: "Expand printStatement → expression. The binaryExpression has two numberLiteral children and a + operator. This is the structure the emitter consumes.", tab: "ast" },
      { title: "The stack does the work", text: "Find i32.const 2 and i32.const 3, each followed by f32.convert_i32_s. f32.add consumes those two values and leaves 5. call 0 passes it to env.print_f32.", tab: "instructions" },
      { title: "Instructions are bytes", text: "In Instructions, click f32.add to highlight its byte, 92, here. The first eight bytes are the WASM magic and version. Download the module to inspect it elsewhere.", tab: "bytes" },
    ],
  },
  branches: {
    name: "Where does continue go?",
    description: "Nested loops, structured labels, and the increment we must not skip.",
    code: `// continue advances the inner for loop; break exits only that loop.
for row in 0..2
  for col in 0..4
    if (col == 1)
      continue
    end
    if (col == 3)
      break
    end
    print ((row * 10) + col)
  end
end`,
    lesson: [
      { title: "A for loop is lowered", text: "Expand the blockStatement in the AST. for becomes a local declaration and a whileStatement with a separate update. That update increments the loop variable even after continue.", tab: "ast" },
      { title: "Branches target labels", text: "In WASM, br 0 targets the nearest enclosing block or loop. Larger depths reach outward. The extra block around a for body lets continue land immediately before its update.", tab: "instructions" },
      { title: "Check the observable result", text: "Run the program. It prints 0, 2, 10, 12. The inner loop skips 1 and breaks at 3, while the outer loop still runs twice. The offsets in the instruction view are offsets in the real binary.", tab: "bytes" },
    ],
  },
  factorial: {
    name: "A function calls itself",
    description: "Signatures, parameters, and recursion without an interpreter.",
    code: `fn factorial(n)
  if (n <= 1)
    return 1
  end
  return (n * factorial((n - 1)))
end

print factorial(5)`,
    lesson: [
      { title: "Register before emitting", text: "The AST contains a functionDeclaration and a printStatement. ORION registers every function before emitting any body, so the recursive call can resolve its index.", tab: "ast" },
      { title: "Two bodies, one module", text: "Select factorial in the function menu. local.get 0 reads its f32 parameter. call 3 invokes factorial again. Functions 0 and 1 are host imports; function 2 is run.", tab: "instructions" },
      { title: "An ordinary WASM call", text: "Run it to see 120. Recursion uses WASM call instructions and the engine’s call stack. ORION does not interpret the AST at runtime. Deep unbounded recursion can still exhaust the stack.", tab: "bytes" },
    ],
  },
};
export const EXAMPLES: Record<string, Example> = { ...LESSONS };
for (const group of EXAMPLE_GROUPS) Object.assign(EXAMPLES, group.items);
