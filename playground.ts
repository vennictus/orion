import * as monaco from 'monaco-editor';
import { tokenize } from './src/tokenizer';
import { parse } from './src/parser';
import { emitter, EmitterOptions } from './src/wasm/module';

/* ---------- EXAMPLE PROGRAMS ---------- */

interface Example {
  name: string;
  code: string;
  width?: number;
  height?: number;
}

interface ExampleGroup {
  label: string;
  items: Record<string, Example>;
}

const EXAMPLE_GROUPS: ExampleGroup[] = [
  {
    label: 'Fractals',
    items: {
      mandelbrot: {
        name: 'Mandelbrot Set',
        code: `// Mandelbrot Set Fractal
let y = 0
while (y < 100)
  let x = 0
  while (x < 100)
    let cx = (((x / 100) * 3.5) - 2.5)
    let cy = (((y / 100) * 2.0) - 1.0)
    let zx = 0
    let zy = 0
    let i = 0

    while (i < 255)
      let zx2 = (zx * zx)
      let zy2 = (zy * zy)
      if ((zx2 + zy2) > 4)
        break
      end
      let newZx = ((zx2 - zy2) + cx)
      let newZy = (((2 * zx) * zy) + cy)
      zx = newZx
      zy = newZy
      i = (i + 1)
    end

    // Color mapping: blue to orange gradient
    let r = i
    let g = (i / 2)
    let b = (255 - i)
    setpixelrgb x y r g b
    x = (x + 1)
  end
  y = (y + 1)
end`,
        width: 100,
        height: 100,
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

// Flatten for easy lookup
const EXAMPLES: Record<string, Example> = {};
for (const group of EXAMPLE_GROUPS) {
  for (const [key, ex] of Object.entries(group.items)) {
    EXAMPLES[key] = ex;
  }
}

/* ---------- ASTRA LANGUAGE ---------- */

monaco.languages.register({ id: 'astra' });

monaco.languages.setMonarchTokensProvider('astra', {
  keywords: ['print', 'let', 'if', 'else', 'end', 'while', 'break', 'continue', 'setpixel', 'setpixelrgb', 'for', 'in', 'not', 'fn', 'return'],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/\b(print|let|if|else|end|while|break|continue|setpixel|setpixelrgb|for|in|not|fn|return)\b/, 'keyword'],
      [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
      [/[0-9]+(\.[0-9]+)?/, 'number'],
      [/[+\-*\/=<>!&|.]+/, 'operator'],
      [/[()]/, 'delimiter'],
      [/\s+/, 'white'],
    ],
  },
});

monaco.editor.defineTheme('sunset', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'f97316', fontStyle: 'bold' },
    { token: 'identifier', foreground: 'e8e8ed' },
    { token: 'number', foreground: 'fbbf24' },
    { token: 'operator', foreground: 'fb7185' },
    { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
    { token: 'delimiter', foreground: '8888a0' },
  ],
  colors: {
    'editor.background': '#0c1220',
    'editor.foreground': '#e8e8ed',
    'editor.lineHighlightBackground': '#101828',
    'editorCursor.foreground': '#f97316',
    'editor.selectionBackground': '#f9731633',
    'editorLineNumber.foreground': '#4b5563',
    'editorLineNumber.activeForeground': '#fbbf24',
    'editorGutter.background': '#0c1220',
  },
});

/* ---------- DOM ---------- */

const editorContainer = document.getElementById('editor-container')!;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const consoleEl = document.getElementById('console')!;
const runBtn = document.getElementById('run-btn') as HTMLButtonElement;
const formatBtn = document.getElementById('format-btn')!;
const clearConsoleBtn = document.getElementById('clear-console-btn')!;
const examplesSelect = document.getElementById('examples') as HTMLSelectElement;
const canvasWidthInput = document.getElementById('canvas-width') as HTMLInputElement;
const canvasHeightInput = document.getElementById('canvas-height') as HTMLInputElement;
const widthDecBtn = document.getElementById('width-dec')!;
const widthIncBtn = document.getElementById('width-inc')!;
const heightDecBtn = document.getElementById('height-dec')!;
const heightIncBtn = document.getElementById('height-inc')!;
const clearBtn = document.getElementById('clear-btn')!;
const fileNameEl = document.getElementById('file-name')!;
const statusTokens = document.getElementById('status-tokens')!;
const statusWasm = document.getElementById('status-wasm')!;

const metricCompile = document.getElementById('metric-compile')!;
const metricExec = document.getElementById('metric-exec')!;
const metricWasm = document.getElementById('metric-wasm')!;
const metricTokens = document.getElementById('metric-tokens')!;
const metricAst = document.getElementById('metric-ast')!;

/* ---------- STATE ---------- */

let lastRunCode = '';
let currentFileName = 'EXAMPLES/MANDELBROT.ASTRA';

/* ---------- EDITOR ---------- */

const editor = monaco.editor.create(editorContainer, {
  value: EXAMPLES.mandelbrot.code,
  language: 'astra',
  theme: 'sunset',
  fontSize: 13,
  fontFamily: "'JetBrains Mono', monospace",
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbers: 'on',
  renderLineHighlight: 'line',
  automaticLayout: true,
  padding: { top: 16, bottom: 16 },
  tabSize: 2,
  cursorBlinking: 'smooth',
  smoothScrolling: true,
});

/* ---------- HELPERS ---------- */

function getTimestamp(): string {
  const now = new Date();
  return `[${now.toLocaleTimeString('en-US', { hour12: false })}]`;
}

function log(msg: string, type: 'msg' | 'info' | 'success' | 'warn' | 'error' = 'msg') {
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="log-time">${getTimestamp()}</span><span class="log-${type}">${msg}</span>`;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function clearConsole() {
  consoleEl.innerHTML = '';
}

function clearCanvas() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function updateCanvasSize() {
  const w = Math.min(500, Math.max(50, parseInt(canvasWidthInput.value) || 100));
  const h = Math.min(500, Math.max(50, parseInt(canvasHeightInput.value) || 100));
  canvasWidthInput.value = String(w);
  canvasHeightInput.value = String(h);
  canvas.width = w;
  canvas.height = h;
  
  // Scale canvas to fit within wrapper (max 320px either dimension)
  const maxDisplay = 320;
  const scale = Math.min(maxDisplay / w, maxDisplay / h, 1);
  canvas.style.width = `${Math.round(w * scale)}px`;
  canvas.style.height = `${Math.round(h * scale)}px`;
  
  clearCanvas();
}

function adjustSize(input: HTMLInputElement, delta: number) {
  const current = parseInt(input.value) || 100;
  const newVal = Math.min(500, Math.max(50, current + delta));
  input.value = String(newVal);
  updateCanvasSize();
}

function formatCode() {
  const code = editor.getValue();
  const lines = code.split('\n');
  let indent = 0;
  const formatted: string[] = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) {
      formatted.push('');
      continue;
    }
    
    // Decrease indent for end, else
    if (/^(end|else)\b/.test(line)) {
      indent = Math.max(0, indent - 1);
    }
    
    formatted.push('  '.repeat(indent) + line);
    
    // Increase indent after if, while, for, else, fn (but not end)
    if (/^(if|while|for|else|fn)\b/.test(line) && !/\bend\b/.test(line)) {
      indent++;
    }
  }
  
  editor.setValue(formatted.join('\n'));
}

function renderToCanvas(mem: Uint8Array, w: number, h: number) {
  const img = ctx.createImageData(w, h);
  // Memory is now RGBA format (4 bytes per pixel)
  for (let i = 0; i < w * h * 4; i++) {
    img.data[i] = mem[i];
  }
  ctx.putImageData(img, 0, 0);
}

function countNodes(node: any): number {
  if (!node) return 0;
  if (Array.isArray(node)) return node.reduce((s, n) => s + countNodes(n), 0);
  if (typeof node === 'object') {
    let c = 1;
    for (const k of Object.keys(node)) if (k !== 'type') c += countNodes(node[k]);
    return c;
  }
  return 0;
}

function formatMetric(value: number, unit: string): string {
  const rounded = Math.round(value);
  return `${rounded}${unit}`;
}

/* ---------- RUN ---------- */

async function runCode() {
  const source = editor.getValue();
  const w = canvas.width;
  const h = canvas.height;

  clearConsole();
  clearCanvas();

  log('INFO: Initializing ASTRA v1.0.0-STABLE...', 'info');

  try {
    const t0 = performance.now();
    log('STDOUT: Compiling src/main.astra', 'msg');
    
    const tokens = tokenize(source);
    const t1 = performance.now();
    const ast = parse(tokens);
    const t2 = performance.now();
    
    log('STDOUT: Linking @astra/graphics/wasm-v2', 'msg');
    const wasm = emitter(ast, { width: w, height: h });
    const t3 = performance.now();

    const compileTime = t3 - t0;
    metricCompile.textContent = formatMetric(compileTime, 'ms');
    metricWasm.textContent = formatMetric(wasm.length, 'B');
    metricTokens.textContent = String(tokens.length);
    metricAst.textContent = String(countNodes(ast));
    statusTokens.textContent = String(tokens.length);
    statusWasm.textContent = `${wasm.length}B`;

    log('SUCCESS: Compilation finished. No errors.', 'success');
    log('STDOUT: Executing entry main()...', 'msg');

    const { instance } = await WebAssembly.instantiate(wasm.slice().buffer, {
      env: {
        print_f32: (v: number) => log(`LOG: print → ${v}`, 'warn'),
        print_i32: (v: number) => log(`LOG: print → ${v}`, 'warn'),
      },
    });

    const mem = instance.exports.memory as WebAssembly.Memory;
    const run = instance.exports.run as Function;

    const t4 = performance.now();
    run();
    const t5 = performance.now();

    const execTime = t5 - t4;
    metricExec.textContent = formatMetric(execTime, 'ms');
    
    renderToCanvas(new Uint8Array(mem.buffer), w, h);

    log(`SUCCESS: Execution complete in ${execTime.toFixed(1)}ms`, 'success');
    lastRunCode = source;

  } catch (e: any) {
    log(`ERROR: ${e.message}`, 'error');
    metricCompile.textContent = '—';
    metricExec.textContent = '—';
    metricWasm.textContent = '—';
    metricTokens.textContent = '—';
    metricAst.textContent = '—';
  }

  // Add prompt
  const prompt = document.createElement('div');
  prompt.className = 'log-prompt';
  prompt.textContent = '> _';
  consoleEl.appendChild(prompt);
}

/* ---------- EVENTS ---------- */

runBtn.addEventListener('click', runCode);
formatBtn.addEventListener('click', formatCode);
clearConsoleBtn.addEventListener('click', clearConsole);
clearBtn.addEventListener('click', () => {
  clearCanvas();
  clearConsole();
  log('Canvas and console cleared.', 'info');
});

// Size adjustment buttons (+/- 50)
widthDecBtn.addEventListener('click', () => adjustSize(canvasWidthInput, -50));
widthIncBtn.addEventListener('click', () => adjustSize(canvasWidthInput, 50));
heightDecBtn.addEventListener('click', () => adjustSize(canvasHeightInput, -50));
heightIncBtn.addEventListener('click', () => adjustSize(canvasHeightInput, 50));

examplesSelect.addEventListener('change', () => {
  const key = examplesSelect.value;
  const ex = EXAMPLES[key];
  if (!ex) return;
  editor.setValue(ex.code);
  if (ex.width) canvasWidthInput.value = String(ex.width);
  if (ex.height) canvasHeightInput.value = String(ex.height);
  updateCanvasSize();
  
  // Update file name
  currentFileName = `EXAMPLES/${key.toUpperCase()}.ASTRA`;
  fileNameEl.textContent = currentFileName;
  
  examplesSelect.value = '';
});

canvasWidthInput.addEventListener('change', updateCanvasSize);
canvasHeightInput.addEventListener('change', updateCanvasSize);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runCode();
  }
});

/* ---------- INIT ---------- */

updateCanvasSize();
lastRunCode = editor.getValue();
runCode();

