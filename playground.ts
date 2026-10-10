import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { EXAMPLES, EXAMPLE_GROUPS, LESSONS, Example } from './playground/examples';
import { RUN_TIMEOUT_MS, MAX_OUTPUT_LINES, WorkerResponse } from './playground/protocol';
import type { Instruction } from './src/wasm/inspect';
import './playground/styles.css';
import { EXAMPLE_INFO } from './playground/example-info';

(globalThis as typeof globalThis & { MonacoEnvironment: unknown }).MonacoEnvironment = { getWorker: () => new EditorWorker() };
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const canvas = $<HTMLCanvasElement>('canvas');
const context = canvas.getContext('2d')!;
const runButton = $<HTMLButtonElement>('run-btn');
const stopButton = $<HTMLButtonElement>('stop-btn');
const inspectButton = $<HTMLButtonElement>('inspect-btn');
const downloadButton = $<HTMLButtonElement>('download-wasm-btn');
const functionSelect = $<HTMLSelectElement>('function-select');
const widthInput = $<HTMLInputElement>('canvas-width');
const heightInput = $<HTMLInputElement>('canvas-height');
type Stage = 'tokens' | 'ast' | 'instructions' | 'bytes';
type Artifact = Extract<WorkerResponse, { type: 'compiled' }> & { source: string; width: number; height: number };
let artifact: Artifact | undefined;
let worker: Worker | undefined;
let deadline: ReturnType<typeof setTimeout> | undefined;
let stage: Stage = 'tokens';
let selectedInstruction: Instruction | undefined;
let selectedFunction = 0;
let currentExample = 'mandelbrot';
let example: Example = EXAMPLES[currentExample];
let lessonStep = 0;
let outputCount = 0;
let changingExample = false;
let initialShared = false;
let recoveredSource: { source: string; width: number; height: number; example?: string } | undefined;
try {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has('code')) {
    const source = hash.get('code')!;
    if (source.length > 100_000) throw new Error('Shared program is too large');
    recoveredSource = { source, width: Number(hash.get('w')) || 100, height: Number(hash.get('h')) || 100 };
    initialShared = true;
  } else {
    const saved = localStorage.getItem('orion.workspace.v1');
    if (saved) recoveredSource = JSON.parse(saved);
  }
} catch { /* Unavailable storage or malformed saved data should not block startup. */ }
if (recoveredSource?.example && EXAMPLES[recoveredSource.example]) {
  currentExample = recoveredSource.example;
  example = EXAMPLES[currentExample];
}
const queryExample = new URLSearchParams(location.search).get('example');
if (queryExample && EXAMPLES[queryExample]) {
  currentExample = queryExample;
  example = EXAMPLES[currentExample];
  if (!initialShared) recoveredSource = undefined;
}
if (recoveredSource && typeof recoveredSource.source !== 'string') recoveredSource = undefined;

monaco.languages.register({ id: 'astra' });
monaco.languages.setMonarchTokensProvider('astra', {
  tokenizer: { root: [
    [/\/\/.*$/, 'comment'],
    [/\b(print|let|if|else|end|while|break|continue|setpixel|setpixelrgb|for|in|not|fn|return)\b/, 'keyword'],
    [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
    [/[0-9]+(\.[0-9]+)?/, 'number'],
    [/[+\-*\/=<>!&|.]+/, 'operator'],
    [/[(){}=,]/, 'delimiter'],
  ] },
});
monaco.languages.setLanguageConfiguration('astra', { comments: { lineComment: '//' }, brackets: [['(', ')'], ['{', '}']], autoClosingPairs: [{ open: '(', close: ')' }, { open: '{', close: '}' }] });
monaco.editor.defineTheme('orion-light', {
  base: 'vs', inherit: true,
  rules: [
    { token: 'keyword', foreground: 'A34836' },
    { token: 'identifier', foreground: '3E3832' },
    { token: 'number', foreground: '526B55' },
    { token: 'operator', foreground: '786A60' },
    { token: 'comment', foreground: '918379', fontStyle: 'italic' },
  ],
  colors: { 'editor.background': '#F6F0E6', 'editor.foreground': '#3E3832', 'editorLineNumber.foreground': '#AC9987', 'editorLineNumber.activeForeground': '#786A60', 'editor.lineHighlightBackground': '#EFE6D8', 'editor.selectionBackground': '#EBCBB6', 'editorCursor.foreground': '#C2683B', 'editorIndentGuide.background1': '#E4D7C7', 'editorGutter.background': '#F6F0E6' },
});
monaco.editor.defineTheme('orion-dark', {
  base: 'vs-dark', inherit: true,
  rules: [
    { token: 'keyword', foreground: 'E99B82' },
    { token: 'identifier', foreground: 'E9DFD4' },
    { token: 'number', foreground: 'A9C09B' },
    { token: 'operator', foreground: 'BDB0A5' },
    { token: 'comment', foreground: '9E8F82', fontStyle: 'italic' },
  ],
  colors: { 'editor.background': '#25211E', 'editor.foreground': '#E9DFD4', 'editorLineNumber.foreground': '#75685E', 'editorLineNumber.activeForeground': '#C3B5A8', 'editor.lineHighlightBackground': '#2D2723', 'editor.selectionBackground': '#634337', 'editorCursor.foreground': '#E99B82', 'editorIndentGuide.background1': '#3B322C', 'editorGutter.background': '#25211E' },
});
const editor = monaco.editor.create($('editor-container'), {
  value: recoveredSource?.source ?? example.code, language: 'astra', theme: `orion-${document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'}`,
  fontSize: 12, lineHeight: 22, fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true,
  padding: { top: 18, bottom: 18 }, tabSize: 2, wordWrap: 'off', renderLineHighlight: 'line',
  lineNumbersMinChars: 3, glyphMargin: false, folding: true, overviewRulerLanes: 0,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
  editContext: false,
});
function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  monaco.editor.setTheme(`orion-${theme}`);
  $('theme-toggle').setAttribute('aria-pressed', String(theme === 'dark'));
  $('theme-toggle').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  $('theme-label').textContent = theme === 'dark' ? 'Light' : 'Dark';
  $('theme-toggle').querySelector('path')!.setAttribute('d', theme === 'dark'
    ? 'M10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM10 1v2M10 17v2M1 10h2M17 10h2M3.6 3.6 5 5M15 15l1.4 1.4M3.6 16.4 5 15M15 5l1.4-1.4'
    : 'M16 12.5A7 7 0 0 1 7.5 4a7 7 0 1 0 8.5 8.5Z');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d1916' : '#eee5d7');
}
applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
$('theme-toggle').onclick = () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem('orion.theme', theme); } catch { /* Theme works without storage. */ }
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
  try { if (localStorage.getItem('orion.theme')) return; } catch { /* Follow system if storage is unavailable. */ }
  applyTheme(event.matches ? 'dark' : 'light');
});

function state(text: string, kind = '') {
  $('run-state').textContent = text;
  $('run-state').dataset.state = kind;
}
function log(text: string, kind = '') {
  if (!kind) $('output-view').dataset.printed = 'true';
  if (kind === 'error' && $('output-view').dataset.mode === 'pending') $('output-view').dataset.mode = 'console';
  const line = make('div', text, `console-line ${kind}`);
  line.dataset.index = kind ? '·' : String(++outputCount);
  $('console').append(line);
  $('console').scrollTop = $('console').scrollHeight;
  $('output-count').textContent = outputCount ? String(outputCount) : '';
}
function clearConsole() { $('console').replaceChildren(); outputCount = 0; $('output-count').textContent = ''; $('output-view').dataset.printed = 'false'; $('output-view').dataset.single = 'false'; $('console-label').textContent = 'Console'; }
function persist() {
  try { localStorage.setItem('orion.workspace.v1', JSON.stringify({ source: editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF), width: canvas.width, height: canvas.height, example: currentExample })); } catch { /* Storage is optional. */ }
}
function dimensions() {
  const clamp = (value: string) => Math.min(500, Math.max(1, Math.trunc(Number(value)) || 100));
  const width = clamp(widthInput.value), height = clamp(heightInput.value);
  widthInput.value = String(width); heightInput.value = String(height);
  canvas.width = width; canvas.height = height;
  $('canvas-empty').hidden = false;
  $<HTMLButtonElement>('save-image-btn').disabled = true;
  // Fit rectangular and square canvases without distortion.
  canvas.style.aspectRatio = `${width} / ${height}`;
  canvas.style.width = width >= height ? '100%' : 'auto';
  canvas.style.height = width >= height ? 'auto' : '100%';
  $('canvas-size').textContent = `${width} × ${height}`;
}
function finish() {
  if (deadline) clearTimeout(deadline);
  deadline = undefined;
  worker?.terminate(); worker = undefined;
  stopButton.disabled = true;
  runButton.disabled = false; inspectButton.disabled = false;
}
function stop(reason = 'Stopped') { finish(); if ($('output-view').dataset.mode === 'pending') $('output-view').dataset.mode = 'console'; state(reason); log(reason === 'Stopped' ? 'Execution stopped. Your editor is ready.' : reason, 'info'); }
function syncDimensions() {
  if (Number(widthInput.value) === canvas.width && Number(heightInput.value) === canvas.height) return;
  dimensions(); $('output-view').dataset.mode = 'pending'; persist();
}
function build(execute: boolean) {
  if (execute) setMobilePanel('result');
  finish();
  syncDimensions();
  if (execute) { clearConsole(); $('output-view').dataset.mode = 'pending'; }
  const source = editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF);
  artifact = undefined; selectedInstruction = undefined; selectedFunction = 0;
  downloadButton.disabled = true;
  for (const id of ['metric-compile', 'metric-validate', 'metric-exec', 'metric-wasm']) $(id).textContent = '—';
  renderLab();
  monaco.editor.setModelMarkers(editor.getModel()!, 'astra', []);
  if (execute) dimensions();
  persist();
  if (execute) $('canvas-empty').hidden = true;
  state(execute ? 'Running' : 'Compiling', 'running');
  runButton.disabled = true; inspectButton.disabled = true; stopButton.disabled = false;
  const active = new Worker(new URL('./playground/runner.worker.ts', import.meta.url), { type: 'module' });
  worker = active;
  const width = canvas.width, height = canvas.height;
  deadline = setTimeout(() => {
    if (worker !== active) return;
    finish(); state('Time limit', 'error');
    log(`Stopped after ${RUN_TIMEOUT_MS / 1000} seconds. Check loop conditions or try a smaller program.`, 'error');
  }, RUN_TIMEOUT_MS);
  active.onerror = (event) => {
    if (worker !== active) return;
    finish(); state('Error', 'error'); log(event.message || 'The program worker could not start.', 'error');
  };
  active.onmessage = (event: MessageEvent<WorkerResponse>) => {
    if (worker !== active) return;
    const message = event.data;
    if (message.type === 'compiled') {
      artifact = { ...message, source, width, height };
      $('metric-compile').textContent = `${message.compileMs.toFixed(1)} ms`;
      $('metric-validate').textContent = `${message.validationMs.toFixed(1)} ms`;
      $('metric-wasm').textContent = `${message.wasm.length.toLocaleString()} B`;
      $('edited-dot').hidden = editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF) === source;
      downloadButton.disabled = false;
      functionSelect.replaceChildren(...message.inspection.functions.map((f, i) => {
        const option = make('option', `${f.name} · ${f.index}`); option.value = String(i); return option;
      }));
      renderLab();
      if (!execute) { finish(); state('Compiled'); }
    } else if (message.type === 'output') {
      message.values.forEach(value => log(String(value)));
      if (message.truncated) log(`Console limited to ${MAX_OUTPUT_LINES.toLocaleString()} lines. Execution continues.`, 'warn');
    } else if (message.type === 'complete') {
      const image = context.createImageData(width, height);
      image.data.set(new Uint8Array(message.pixels));
      context.putImageData(image, 0, 0);
      const hasPixels = image.data.some((v, i) => i % 4 === 3 && v !== 0);
      $('canvas-empty').hidden = hasPixels;
      $('output-view').dataset.mode = hasPixels ? 'canvas' : 'console';
      const singleResult = !hasPixels && outputCount === 1 && $('console').children.length === 1;
      $('output-view').dataset.single = String(singleResult);
      $('console-label').textContent = singleResult ? 'Result' : 'Console';
      $<HTMLButtonElement>('save-image-btn').disabled = !hasPixels;
      $('metric-exec').textContent = `${message.executionMs.toFixed(1)} ms`;
      if (outputCount === 0) log('Finished without console output.', 'info');
      finish(); state(editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF) === source ? 'Finished' : 'Edited · run to update');
    } else {
      finish(); state('Error', 'error'); log(message.message, 'error');
      if (!artifact) { $('lab-content').replaceChildren(make('p', message.message, 'compile-error')); $('lab-summary').textContent = 'Compilation failed · check the source'; }
      const location = message.message.match(/line (\d+), column (\d+)/);
      if (location && editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF) === source) {
        const line = Number(location[1]), col = Number(location[2]);
        monaco.editor.setModelMarkers(editor.getModel()!, 'astra', [{ severity: monaco.MarkerSeverity.Error, message: message.message, startLineNumber: line, startColumn: col, endLineNumber: line, endColumn: col + 1 }]);
      }
    }
  };
  active.postMessage({ source, width, height, execute });
}
function setView(view: 'output' | 'lab') {
  setMobilePanel('result');
  for (const name of ['output', 'lab']) {
    $(`view-${name}`).setAttribute('aria-selected', String(name === view));
    $(`view-${name}`).tabIndex = name === view ? 0 : -1;
    $(name === 'output' ? 'output-view' : 'lab-view').hidden = name !== view;
  }
  if (view === 'lab') renderLab();
}
function setMobilePanel(panel: 'code' | 'result') {
  document.querySelector<HTMLElement>('.workspace')!.dataset.panel = panel;
  $('mobile-code').setAttribute('aria-pressed', String(panel === 'code'));
  $('mobile-result').setAttribute('aria-pressed', String(panel === 'result'));
}
function setStage(next: Stage) {
  stage = next;
  document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(button => { button.setAttribute('aria-selected', String(button.dataset.stage === stage)); button.tabIndex = button.dataset.stage === stage ? 0 : -1; });
  renderLab();
}
const hex = (n: number, width = 6) => n.toString(16).padStart(width, '0');
function artifactMatchesCurrent() { return artifact && artifact.source === editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF) && artifact.width === canvas.width && artifact.height === canvas.height; }
function renderLab() {
  const content = $('lab-content'); content.replaceChildren();
  functionSelect.hidden = stage !== 'instructions' || !artifact;
  if (!artifact) {
    $('lab-summary').textContent = 'Compile or run a program to inspect it.';
    content.append(make('p', 'Your source becomes tokens, a syntax tree, then an executable WebAssembly module. Choose a guided example to follow the journey.', 'inspector-empty'));
    return;
  }
  const stale = !artifactMatchesCurrent();
  $('lab-description').textContent = stale ? 'Showing the last build. Compile to inspect your edits.' : 'The real compiler output, one stage at a time.';
  const { tokens, ast, wasm, inspection } = artifact;
  $('selection-info').textContent = selectedInstruction ? `${selectedInstruction.mnemonic} · 0x${hex(selectedInstruction.offset)}–${hex(selectedInstruction.end - 1)}` : 'Click an instruction to locate its bytes.';
  if (stage === 'tokens') {
    $('lab-summary').textContent = `${tokens.length.toLocaleString()} tokens · click a value to find its source`;
    const table = make('table', undefined, 'token-table');
    const head = make('thead'), row = make('tr');
    ['Value', 'Kind', 'Line:col'].forEach(title => row.append(make('th', title)));
    head.append(row); table.append(head);
    const body = make('tbody');
    tokens.slice(0, 2000).forEach(token => {
      const tr = make('tr'), td = make('td'), button = make('button', token.value, 'token-value');
      button.disabled = stale;
      button.onclick = () => {
        editor.setSelection({ startLineNumber: token.line, startColumn: token.char, endLineNumber: token.line, endColumn: token.char + token.value.length });
        editor.revealLineInCenterIfOutsideViewport(token.line); editor.focus();
      };
      td.append(button); tr.append(td, make('td', token.type, 'token-type'), make('td', `${token.line}:${token.char}`, 'token-loc')); body.append(tr);
    });
    table.append(body); content.append(table);
    if (tokens.length > 2000) content.append(make('p', 'Showing the first 2,000 tokens.', 'limit-note'));
  } else if (stage === 'ast') {
    $('lab-summary').textContent = `${ast.length} top-level nodes · expandable compiler AST`;
    const tree = make('div', undefined, 'ast-tree');
    let count = 0;
    const branch = (key: string, value: unknown, depth: number): HTMLElement => {
      if (++count > 4000) return make('div', '… tree display limit reached', 'ast-leaf');
      if (value !== null && typeof value === 'object') {
        const detail = make('details'); detail.open = depth < 2;
        const type = Array.isArray(value) ? `[${value.length}]` : (value as { type?: string }).type ?? 'object';
        detail.append(make('summary', `${key} · ${type}`));
        for (const [k, v] of Object.entries(value)) {
          if (count > 4000) break;
          if (k !== 'type') detail.append(branch(k, v, depth + 1));
        }
        return detail;
      }
      const leaf = make('div', undefined, 'ast-leaf'); leaf.append(make('b', `${key}: `), document.createTextNode(JSON.stringify(value))); return leaf;
    };
    tree.append(branch('Program', ast, 0)); content.append(tree);
  } else if (stage === 'instructions') {
    const fn = inspection.functions[selectedFunction];
    if (!fn) return;
    $('lab-summary').textContent = `${fn.instructions.length} instructions · absolute byte offsets`;
    content.append(make('p', fn.locals.length ? `Locals: ${fn.locals.join(', ')}. Parameter indices come first.` : 'No additional locals. Parameters, if any, occupy the first indices.', 'inspector-note'));
    fn.instructions.slice(0, 2000).forEach(instruction => {
      const button = make('button', undefined, `instruction${instruction.offset === selectedInstruction?.offset ? ' selected' : ''}`);
      const code = make('span', undefined, 'instruction-code'); code.style.paddingLeft = `${instruction.depth * 10}px`;
      code.append(make('b', instruction.mnemonic), make('span', instruction.operand ? `  ${instruction.operand}` : ''));
      button.append(make('span', hex(instruction.offset), 'instruction-offset'), code);
      button.title = `View bytes ${hex(instruction.offset)} to ${hex(instruction.end - 1)}`;
      button.onclick = () => { selectedInstruction = instruction; setStage('bytes'); };
      content.append(button);
    });
    if (fn.instructions.length > 2000) content.append(make('p', 'Showing the first 2,000 instructions. The download contains the full module.', 'limit-note'));
  } else {
    $('lab-summary').textContent = `${wasm.length.toLocaleString()} bytes · hexadecimal · section boundaries`;
    inspection.sections.forEach(section => {
      const details = make('details', undefined, 'byte-section');
      const containsSelection = selectedInstruction && selectedInstruction.offset >= section.offset && selectedInstruction.offset < section.end;
      details.open = section.name === 'Header' || section.name === 'Code' || !!containsSelection;
      const summary = make('summary', section.name);
      summary.append(make('span', `${section.end - section.offset} B · 0x${hex(section.offset)}`)); details.append(summary);
      const start = containsSelection && selectedInstruction!.offset - section.offset > 1800 ? Math.max(section.offset, selectedInstruction!.offset - 128) : section.offset;
      const end = Math.min(section.end, start + 2048);
      for (let offset = start; offset < end; offset += 16) {
        const row = make('div', undefined, 'hex-row'), values = make('span', undefined, 'hex-values');
        row.append(make('span', hex(offset), 'hex-offset'));
        for (let i = offset; i < Math.min(offset + 16, end); i++) {
          const selected = selectedInstruction && i >= selectedInstruction.offset && i < selectedInstruction.end;
          const byte = make('span', hex(wasm[i], 2), `hex-byte${selected ? ' selected' : ''}`);
          byte.title = `Offset ${i} (0x${hex(i)})`; values.append(byte);
        }
        row.append(values); details.append(row);
      }
      if (end - start < section.end - section.offset) details.append(make('p', 'Displaying a 2 KB window. Download the complete module below.', 'limit-note'));
      content.append(details);
    });
    content.querySelector('.hex-byte.selected')?.scrollIntoView({ block: 'nearest' });
  }
}
function renderLesson() {
  const steps = editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF) === example.code ? example.lesson : undefined;
  $('lesson').hidden = !steps;
  if (!steps) return;
  const step = steps[lessonStep];
  $('lesson-step-label').textContent = `${lessonStep + 1} / ${steps.length} · Guided exploration`;
  $('lesson-title').textContent = step.title; $('lesson-text').textContent = step.text;
  $<HTMLButtonElement>('lesson-prev').disabled = lessonStep === 0;
  $<HTMLButtonElement>('lesson-next').disabled = lessonStep === steps.length - 1;
  setStage(step.tab);
}
function loadExample(key: string) {
  finish();
  history.replaceState(null, '', location.pathname);
  currentExample = key; example = EXAMPLES[key]; lessonStep = 0;
  changingExample = true;
  editor.pushUndoStop(); editor.executeEdits('example', [{ range: editor.getModel()!.getFullModelRange(), text: example.code }]); editor.pushUndoStop();
  changingExample = false;
  widthInput.value = String(example.width ?? 100); heightInput.value = String(example.height ?? 100); dimensions();
  clearConsole(); $('output-view').dataset.mode = example.lesson ? 'console' : 'pending';
  $('source-title').textContent = `${key}.astra`;
  document.querySelectorAll<HTMLElement>('[data-example]').forEach(button => { button.classList.toggle('active', button.dataset.example === key); button.setAttribute('aria-pressed', String(button.dataset.example === key)); });
  renderLesson(); setView(example.lesson ? 'lab' : 'output');
  updateProgramPicker();
  build(!example.lesson);
}
function showExampleInfo(key: string) {
  const info = EXAMPLE_INFO[key];
  if (!info) return;
  $('example-info-title').textContent = EXAMPLES[key].name;
  $('example-info-description').textContent = info.description;
  $('example-info-formula').textContent = info.formula;
  $('example-info-rendering').textContent = info.rendering;
  $<HTMLDialogElement>('example-dialog').showModal();
}
function updateProgramPicker() {
  const matches = editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF) === example.code;
  $('current-example-name').textContent = matches ? example.name : 'Custom program';
  $<HTMLSelectElement>('mobile-program').value = matches ? currentExample : '';
  $('current-example-info').hidden = !matches || !EXAMPLE_INFO[currentExample];
  $('current-example-info').setAttribute('aria-label', `About ${example.name}`);
}
function library() {
  const list = $('library-list');
  const select = $<HTMLSelectElement>('mobile-program');
  let optionGroup: HTMLOptGroupElement;
  let groupList = list;
  const group = (label: string) => { groupList = make('section', undefined, 'library-group-block'); groupList.append(make('h3', label, 'library-group')); list.append(groupList); optionGroup = make('optgroup'); optionGroup.label = label; select.append(optionGroup); };
  const item = (key: string, entry: Example, lessonIndex?: number) => {
    const option = make('option', entry.name); option.value = key; optionGroup.append(option);
    const active = key === currentExample && editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF) === entry.code;
    const button = make('button', undefined, `library-item${entry.lesson ? ' lesson-item' : ''}${active ? ' active' : ''}`);
    button.dataset.example = key; button.setAttribute('aria-pressed', String(active)); button.title = entry.description ?? entry.name;
    if (lessonIndex !== undefined) button.append(make('span', String(lessonIndex + 1).padStart(2, '0'), 'lesson-number'));
    else {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', 'M3 12 6 7l3 3 3-6M3 3h10v10H3Z'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.1'); svg.append(path); button.append(svg);
    }
    button.append(make('span', entry.name)); button.onclick = () => loadExample(key);
    const info = EXAMPLE_INFO[key];
    if (info) {
      const row = make('div', undefined, 'library-entry');
      const infoButton = make('button', 'i', 'example-info-button');
      infoButton.setAttribute('aria-label', `About ${entry.name}`); infoButton.title = `About ${entry.name}`;
      infoButton.setAttribute('aria-haspopup', 'dialog');
      infoButton.onclick = () => showExampleInfo(key);
      row.append(button, infoButton); groupList.append(row);
    } else groupList.append(button);
  };
  group('Learn the compiler');
  Object.entries(LESSONS).forEach(([key, entry], i) => item(key, entry, i));
  for (const entry of EXAMPLE_GROUPS) { group(entry.label); Object.entries(entry.items).forEach(([key, entry]) => item(key, entry)); }
}
function download(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type })); const a = make('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
runButton.onclick = () => build(true); stopButton.onclick = () => stop(); inspectButton.onclick = () => build(false);
document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(button => button.onclick = () => setStage(button.dataset.stage as Stage));
$('view-output').onclick = () => setView('output'); $('view-lab').onclick = () => setView('lab');
$('clear-console-btn').onclick = clearConsole;
$('format-btn').onclick = () => {
  let indent = 0;
  const source = editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF).split('\n').map(line => {
    const text = line.trim(), code = text.split('//')[0].trim();
    if (/^(end|else)\b/.test(code) || code === '}') indent = Math.max(0, indent - 1);
    const result = text ? '  '.repeat(indent) + text : '';
    if ((/^(if|while|for|else|fn)\b/.test(code) && !/\bend\b/.test(code)) || code === '{') indent++;
    return result;
  }).join('\n');
  editor.executeEdits('format', [{ range: editor.getModel()!.getFullModelRange(), text: source }]); editor.focus();
};
functionSelect.onchange = () => { selectedFunction = Number(functionSelect.value); renderLab(); };
$('lesson-prev').onclick = () => { lessonStep--; renderLesson(); }; $('lesson-next').onclick = () => { lessonStep++; renderLesson(); };
function inspectCurrent() {
  syncDimensions();
  setView('lab');
  if (!worker && !artifactMatchesCurrent()) build(false);
  $('lab-content').focus({ preventScroll: true });
}
$('learn-btn').onclick = inspectCurrent;
$('mobile-code').onclick = () => setMobilePanel('code');
$('mobile-result').onclick = () => setMobilePanel('result');
$('mobile-stop').onclick = () => stop();
$<HTMLSelectElement>('mobile-program').onchange = event => { const key = (event.target as HTMLSelectElement).value; if (key) loadExample(key); };
$('current-example-info').onclick = () => showExampleInfo(currentExample);
$('about-btn').onclick = () => $<HTMLDialogElement>('about-dialog').showModal();
$('close-about').onclick = () => $<HTMLDialogElement>('about-dialog').close();
$('about-learn').onclick = () => { $<HTMLDialogElement>('about-dialog').close(); inspectCurrent(); };
$('close-share').onclick = () => $<HTMLDialogElement>('share-dialog').close();
for (const id of ['close-example', 'example-info-done']) $(id).onclick = () => $<HTMLDialogElement>('example-dialog').close();
$('share-btn').onclick = () => {
  const url = new URL(location.href); url.search = ''; url.hash = new URLSearchParams({ code: editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF), w: String(canvas.width), h: String(canvas.height) }).toString();
  $<HTMLInputElement>('share-url').value = url.toString(); $('share-status').textContent = ''; $<HTMLDialogElement>('share-dialog').showModal();
};
$('copy-share').onclick = async () => {
  try { await navigator.clipboard.writeText($<HTMLInputElement>('share-url').value); $('share-status').textContent = 'Copied.'; }
  catch { $<HTMLInputElement>('share-url').select(); $('share-status').textContent = 'Select and copy the link.'; }
};
$('save-image-btn').onclick = () => canvas.toBlob(blob => { if (blob) download(blob, `${currentExample}.png`, 'image/png'); });
downloadButton.onclick = () => { if (artifact) download(artifact.wasm.slice().buffer, `${currentExample}.wasm`, 'application/wasm'); };
for (const input of [widthInput, heightInput]) input.onchange = () => { if (worker) stop(); syncDimensions(); renderLab(); state('Canvas resized · run to update'); };
editor.onDidChangeModelContent(() => {
  if (changingExample) return;
  $('edited-dot').hidden = false; persist();
  updateProgramPicker();
  $('lesson').hidden = editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF) !== example.code || !example.lesson;
  document.querySelectorAll<HTMLElement>('[data-example]').forEach(button => {
    const active = button.dataset.example === currentExample && editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF) === example.code;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  if (!worker) state('Edited · run to update');
  if (artifact) {
    $('lab-description').textContent = 'Showing the last build. Compile to inspect your edits.';
    document.querySelectorAll<HTMLButtonElement>('.token-value').forEach(button => button.disabled = editor.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF) !== artifact!.source);
  }
});
editor.onDidChangeCursorPosition(event => $('source-position').textContent = `Ln ${event.position.lineNumber}, Col ${event.position.column}`);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !document.querySelector('dialog[open]')) { event.preventDefault(); build(true); }
  if (event.key === 'Escape' && worker && !document.querySelector('dialog[open]')) stop();
});
for (const id of ['lab-tabs', 'view-output']) {
  const parent = id === 'view-output' ? $('view-output').parentElement! : $(id);
  parent.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const tabs = Array.from(parent.querySelectorAll<HTMLButtonElement>('[role=tab]'));
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault(); const next = tabs[(current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; next.click(); next.focus();
  });
}
window.addEventListener('beforeunload', () => finish());
window.addEventListener('hashchange', () => location.reload());
library();
updateProgramPicker();
widthInput.value = String(recoveredSource?.width ?? example.width ?? 100); heightInput.value = String(recoveredSource?.height ?? example.height ?? 100); dimensions();
$('source-title').textContent = recoveredSource ? (initialShared ? 'shared.astra' : 'workspace.astra') : `${currentExample}.astra`;
renderLesson(); setView(example.lesson ? 'lab' : 'output');
build(!recoveredSource && !example.lesson);

