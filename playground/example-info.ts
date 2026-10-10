/** Explanations describe the specific programs shipped in this playground. */
export const EXAMPLE_INFO: Record<string, { description: string; formula: string; rendering: string }> = {
  mandelbrot: {
    description: 'Each pixel is a complex number c. Starting at zero, repeatedly square the current value and add c. The Mandelbrot set contains the values of c whose orbit stays bounded.',
    formula: 'z₀ = 0\nzₙ₊₁ = zₙ² + c',
    rendering: 'The dark region has not escaped within 160 iterations; this finite test approximates the set. Outside it, the blue bands show how quickly the orbit escapes. The small details repeat as you move along the boundary.',
  },
  julia: {
    description: 'A Julia fractal uses the same quadratic iteration as Mandelbrot, but keeps c fixed and starts z at each pixel. This example shows the filled Julia set for one particular c.',
    formula: 'c = −0.7 + 0.27015i\nz₀ = pixel position\nzₙ₊₁ = zₙ² + c',
    rendering: 'Each pixel follows a different starting orbit through the same rule. Its color comes from the escape count. The iteration limit gives a finite approximation of the filled set.',
  },
  burningship: {
    description: 'The Burning Ship folds both components of z onto their absolute values before squaring. That small change to the Mandelbrot rule creates sharp, ship-like forms.',
    formula: 'z₀ = 0\nzₙ₊₁ = (|Re(zₙ)| + i|Im(zₙ)|)² + c',
    rendering: 'The source performs the fold with two conditional negations. The escape count drives the colors; the image orientation follows the canvas coordinate system, where y increases downward.',
  },
  gradient: {
    description: 'A color gradient changes red, green, and blue smoothly across an image. This is a simple way to see how coordinates become bytes in linear memory.',
    formula: 't = (x + y) / 2\nred = 128 + 1.2t\ngreen = 64 + t\nblue = 255 − t',
    rendering: 'There is no fractal iteration here. Two loops visit every pixel and compute its three channels directly from x and y.',
  },
  checkerboard: {
    description: 'Divide the image into square cells and alternate their colors. Moving one cell horizontally or vertically flips the color.',
    formula: 'color ← parity(cellX + cellY)',
    rendering: 'ASTRA computes the cell indices and their parity using loops and subtraction. Alternating orange and gold cells reveal the grid.',
  },
  stripes: {
    description: 'Pixels with the same x + y lie along a diagonal. Repeating a color rule along that sum creates parallel stripes.',
    formula: 'band ← repeating interval of (x + y)',
    rendering: 'The program reduces the coordinate sum into a repeating interval, then chooses mint or dark blue. Change the interval in the source to adjust the stripe spacing.',
  },
  plasma: {
    description: 'This example combines coordinate arithmetic into a repeating color field. It is an arithmetic plasma-like effect rather than a physical simulation.',
    formula: 'color channels ← combinations of x and y',
    rendering: 'The three channels vary at different rates. Pixel stores retain each channel’s low eight bits, so values wrap into repeating color bands.',
  },
  circles: {
    description: 'Points at the same distance from a center form a circle. Repeating a rule over squared distance produces concentric rings without computing a square root.',
    formula: 'd² = (x − centerX)² + (y − centerY)²',
    rendering: 'The program alternates orange and dark bands from this value. Because it uses squared distance, the visible rings become more tightly spaced farther from the center.',
  },
  sierpinski: {
    description: 'The Sierpinski triangle is a self-similar pattern of triangles with triangular gaps. This program draws a pixel-grid version by examining the binary digits of x and y.',
    formula: 'lit pixel when (x AND y) = 0',
    rendering: 'ASTRA checks corresponding binary digits with arithmetic and loops rather than a bitwise operator. A shared 1 bit makes a pixel dark; the remaining pixels form repeating gold triangles.',
  },
  crosshatch: {
    description: 'Two families of repeated lines cross to form a woven grid. This pattern is built from simple coordinate tests.',
    formula: 'line when x or y reaches a repeating boundary',
    rendering: 'Orange lines cross over a dark background. The source reduces coordinates into repeating intervals and checks their positions within each interval.',
  },
  functions: {
    description: 'This picture demonstrates user-defined functions: squaring values and clamping a result into a useful range before writing a pixel.',
    formula: 'square(n) = n × n\nclamp(value, minimum, maximum)',
    rendering: 'Open Instructions in the Lab and select a function to see its own body. Calls in the drawing loop become real WebAssembly call instructions.',
  },
  recursive: {
    description: 'A recursive function solves a smaller version of its own problem. This example computes factorials and Fibonacci numbers, then draws a small color gradient.',
    formula: 'factorial(n) = n × factorial(n − 1)\nfib(n) = fib(n − 1) + fib(n − 2)',
    rendering: 'Base cases stop the recursion. Look in the console for the numeric results; the gradient is a separate illustration. The calls run on the WebAssembly engine’s stack.',
  },
};
