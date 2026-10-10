// src/wasm/module.ts

import {
  Section,
  ValType,
  Opcode,
  ExportKind,
  FUNC_TYPE,
  BlockType,
} from "./constants";

import { f32, unsignedLEB128, signedLEB128, encodeString } from "./encoding";

import { Program, FunctionDeclarationNode, TopLevelNode, StatementNode, ExpressionNode } from "../types/parser";

/* ---------- WASM HEADERS ---------- */

const MAGIC = [0x00, 0x61, 0x73, 0x6d];
const VERSION = [0x01, 0x00, 0x00, 0x00];

/* ---------- SHARED CONSTANTS ---------- */

export const CANVAS_WIDTH = 100;
export const CANVAS_HEIGHT = 100;

/* ---------- EMITTER OPTIONS ---------- */

export interface EmitterOptions {
  width?: number;
  height?: number;
}

/* ---------- FUNCTION INDICES ---------- */

const IMPORT_COUNT = 2; // print_f32, print_i32
const RUN_FUNC_INDEX = IMPORT_COUNT; // run is first local function

/* ---------- HELPERS ---------- */

function encodeVector(entries: number[][]): number[] {
  return [...unsignedLEB128(entries.length), ...entries.flat()];
}

function createSection(section: Section, payload: number[]): number[] {
  return [section, ...unsignedLEB128(payload.length), ...payload];
}

/* ---------- TYPES ---------- */

type ValueType = "f32" | "i32";

/* ---------- FUNCTION INFO ---------- */

interface FunctionInfo {
  index: number;
  paramCount: number;
  params: string[];
  body: StatementNode[];
}

/* ---------- OPCODE MAP ---------- */

const binaryOpcode: Record<string, { opcode: Opcode; result: ValueType }> = {
  "+": { opcode: Opcode.f32_add, result: "f32" },
  "-": { opcode: Opcode.f32_sub, result: "f32" },
  "*": { opcode: Opcode.f32_mul, result: "f32" },
  "/": { opcode: Opcode.f32_div, result: "f32" },

  "==": { opcode: Opcode.f32_eq, result: "i32" },
  "!=": { opcode: Opcode.f32_ne, result: "i32" },
  "<": { opcode: Opcode.f32_lt, result: "i32" },
  ">": { opcode: Opcode.f32_gt, result: "i32" },
  "<=": { opcode: Opcode.f32_le, result: "i32" },
  ">=": { opcode: Opcode.f32_ge, result: "i32" },
  "&&": { opcode: Opcode.i32_and, result: "i32" },
  "||": { opcode: Opcode.i32_or, result: "i32" },
};

/* ---------- SCOPE STACK ---------- */

interface SymbolInfo {
  index: number;
  type: ValueType;
}

type Scope = Map<string, SymbolInfo>;

/* ---------- LOOP STACK ---------- */

type LoopContext = {
  blockDepth: number; // absolute control depth of the surrounding block
  loopDepth: number;  // absolute control depth of the loop
};

/* ---------- COMPILER STATE ---------- */

interface CompilerState {
  scopes: Scope[];
  localCount: number;
  localTypes: ValueType[];
  controlDepth: number;
  loopStack: LoopContext[];
  functions: Map<string, FunctionInfo>;
  inFunction: boolean;
  width: number;
  height: number;
}

function createState(): CompilerState {
  return {
    scopes: [],
    localCount: 0,
    localTypes: [],
    controlDepth: 0,
    loopStack: [],
    functions: new Map(),
    inFunction: false,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  };
}

function resetForFunction(state: CompilerState, paramCount: number) {
  state.scopes = [];
  state.localCount = paramCount;
  state.localTypes = [];
  state.controlDepth = 0;
  state.loopStack = [];
  state.inFunction = true;
}

function enterScope(state: CompilerState) {
  state.scopes.push(new Map());
}

function exitScope(state: CompilerState) {
  state.scopes.pop();
}

function allocateLocal(state: CompilerState, type: ValueType): number {
  const index = state.localCount++;
  state.localTypes.push(type);
  return index;
}

function declareSymbol(state: CompilerState, name: string, type: ValueType): number {
  const scope = state.scopes[state.scopes.length - 1];
  if (scope.has(name)) throw new Error(`Duplicate variable '${name}' in the same scope`);
  const index = allocateLocal(state, type);
  scope.set(name, { index, type });
  return index;
}

function resolveSymbol(state: CompilerState, name: string): SymbolInfo {
  for (let i = state.scopes.length - 1; i >= 0; i--) {
    const scope = state.scopes[i];
    if (scope.has(name)) {
      return scope.get(name)!;
    }
  }
  throw new Error(`Undefined variable '${name}'`);
}

function emitConversion(code: number[], from: ValueType, to: ValueType) {
  if (from === to) return;
  if (from === "i32" && to === "f32") {
    code.push(Opcode.f32_convert_i32_s);
    return;
  }
  if (from === "f32" && to === "i32") {
    code.push(Opcode.i32_trunc_f32_s);
    return;
  }
  throw new Error(`Cannot convert ${from} to ${to}`);
}

function emitToBool(code: number[], type: ValueType) {
  if (type === "i32") {
    code.push(Opcode.i32_eqz, Opcode.i32_eqz);
    return;
  }
  code.push(Opcode.f32_const);
  code.push(...f32(0));
  code.push(Opcode.f32_eq);
  code.push(Opcode.i32_eqz);
}

function encodeLocalDeclarations(types: ValueType[]): number[][] {
  return types.map((type) => [
    ...unsignedLEB128(1),
    type === "f32" ? ValType.f32 : ValType.i32,
  ]);
}
 

/* ---------- EXPRESSION EMITTER ---------- */

function emitExpression(node: ExpressionNode, code: number[], state: CompilerState): ValueType {
  switch (node.type) {
    case "numberLiteral": {
      if (Number.isInteger(node.value) && node.value >= -2147483648 && node.value <= 2147483647) {
        code.push(Opcode.i32_const);
        code.push(...signedLEB128(node.value));
        return "i32";
      } else {
        code.push(Opcode.f32_const);
        code.push(...f32(node.value));
        return "f32";
      }
    }

    case "identifier": {
      const symbol = resolveSymbol(state, node.name);
      code.push(Opcode.get_local);
      code.push(...unsignedLEB128(symbol.index));
      return symbol.type;
    }

    case "unaryExpression": {
      if (node.operator === "-") {
        // -x → 0 - x
        code.push(Opcode.f32_const);
        code.push(...f32(0));
        const operandType = emitExpression(node.operand, code, state);
        emitConversion(code, operandType, "f32");
        code.push(Opcode.f32_sub);
        return "f32";
      } else if (node.operator === "not") {
        const operandType = emitExpression(node.operand, code, state);
        emitToBool(code, operandType);
        code.push(Opcode.i32_eqz);
        return "i32";
      }
      throw new Error(`Unknown unary operator '${node.operator}'`);
    }

    case "callExpression": {
      const funcInfo = state.functions.get(node.name);
      if (!funcInfo) {
        throw new Error(`Undefined function '${node.name}'`);
      }
      
      if (node.args.length !== funcInfo.paramCount) throw new Error(`Function '${node.name}' expects ${funcInfo.paramCount} arguments, got ${node.args.length}`);
      // Emit arguments
      for (const arg of node.args) {
        const argType = emitExpression(arg, code, state);
        emitConversion(code, argType, "f32");
      }
      
      // Call function
      code.push(Opcode.call);
      code.push(...unsignedLEB128(funcInfo.index));
      return "f32";
    }

    case "binaryExpression": {
      const operator = node.operator;
      const entry = binaryOpcode[operator];
      if (!entry) throw new Error(`Unknown operator '${operator}'`);

      const isArithmetic =
        operator === "+" ||
        operator === "-" ||
        operator === "*" ||
        operator === "/";

      const isComparison =
        operator === "==" ||
        operator === "!=" ||
        operator === "<" ||
        operator === ">" ||
        operator === "<=" ||
        operator === ">=";

      const isLogical = operator === "&&" || operator === "||";

      if (isLogical) {
        const leftType = emitExpression(node.left, code, state);
        emitToBool(code, leftType);
        const rightType = emitExpression(node.right, code, state);
        emitToBool(code, rightType);
        code.push(entry.opcode);
        return entry.result;
      }

      const leftType = emitExpression(node.left, code, state);
      if ((isArithmetic || isComparison) && leftType === "i32") {
        emitConversion(code, leftType, "f32");
      }

      const rightType = emitExpression(node.right, code, state);
      if ((isArithmetic || isComparison) && rightType === "i32") {
        emitConversion(code, rightType, "f32");
      }

      code.push(entry.opcode);
      return entry.result;
    }
  }

  throw new Error("Unknown expression");
}

/* ---------- STATEMENT EMITTER ---------- */
function emitStatement(stmt: StatementNode, code: number[], state: CompilerState) {
  switch (stmt.type) {

    case "printStatement": {
      const type = emitExpression(stmt.expression, code, state);
      code.push(Opcode.call);
      code.push(...unsignedLEB128(type === "f32" ? 0 : 1));
      break;
    }

    case "variableDeclaration": {
      const valueType = emitExpression(stmt.initializer, code, state);
      emitConversion(code, valueType, "f32");

      const index = declareSymbol(state, stmt.name, "f32");
      code.push(Opcode.set_local);
      code.push(...unsignedLEB128(index));
      break;
    }

    case "assignmentStatement": {
      const symbol = resolveSymbol(state, stmt.name);
      const valueType = emitExpression(stmt.value, code, state);

      emitConversion(code, valueType, symbol.type);

      code.push(Opcode.set_local);
      code.push(...unsignedLEB128(symbol.index));
      break;
    }

    case "blockStatement": {
      enterScope(state);
      for (const inner of stmt.body) {
        emitStatement(inner, code, state);
      }
      exitScope(state);
      break;
    }

    /* ---------- IF STATEMENT ---------- */
    case "ifStatement": {
      code.push(Opcode.block);
      code.push(BlockType.void);
      state.controlDepth++;

      code.push(Opcode.block);
      code.push(BlockType.void);
      state.controlDepth++;

      const condType = emitExpression(stmt.condition, code, state);

      if (condType === "f32") {
        // f32 truthiness: x != 0.0
        code.push(Opcode.f32_const);
        code.push(...f32(0));
        code.push(Opcode.f32_eq); // x == 0 → i32
        code.push(Opcode.i32_eqz); // invert → x != 0
      } else if (condType !== "i32") {
        throw new Error("if condition must be i32 or f32");
      }

      code.push(Opcode.i32_eqz);
      code.push(Opcode.br_if);
      code.push(...unsignedLEB128(0));

      enterScope(state);
      for (const inner of stmt.thenBlock) {
        emitStatement(inner, code, state);
      }
      exitScope(state);

      code.push(Opcode.br);
      code.push(...unsignedLEB128(1));

      code.push(Opcode.end);
      state.controlDepth--;

      if (stmt.elseBlock) {
        enterScope(state);
        for (const inner of stmt.elseBlock) {
          emitStatement(inner, code, state);
        }
        exitScope(state);
      }

      code.push(Opcode.end);
      state.controlDepth--;
      break;
    }

    /* ---------- WHILE STATEMENT ---------- */
    case "whileStatement": {

      // block (break target)
      code.push(Opcode.block);
      code.push(BlockType.void);
      state.controlDepth++;

      // loop (continue target)
      code.push(Opcode.loop);
      code.push(BlockType.void);
      state.controlDepth++;

      // store absolute depths
      state.loopStack.push({
        blockDepth: state.controlDepth - 1,
        loopDepth: state.controlDepth - 0,
      });

      const condType = emitExpression(stmt.condition, code, state);
      emitToBool(code, condType);

      code.push(Opcode.i32_eqz);
      code.push(Opcode.br_if);
      code.push(...unsignedLEB128(1));

      if (stmt.update) {
        code.push(Opcode.block, BlockType.void);
        state.controlDepth++;
        state.loopStack[state.loopStack.length - 1].loopDepth = state.controlDepth;
      }
      enterScope(state);
      for (const inner of stmt.body) emitStatement(inner, code, state);
      exitScope(state);
      if (stmt.update) {
        code.push(Opcode.end);
        state.controlDepth--;
        for (const update of stmt.update) emitStatement(update, code, state);
      }

      code.push(Opcode.br);
      code.push(...unsignedLEB128(0));

      state.loopStack.pop();

      code.push(Opcode.end);
      state.controlDepth--;

      code.push(Opcode.end);
      state.controlDepth--;
      break;
    }

    /* ---------- BREAK ---------- */
    case "breakStatement": {
      if (state.loopStack.length === 0) {
        throw new Error("break used outside of loop");
      }

      const ctx = state.loopStack[state.loopStack.length - 1];
      code.push(Opcode.br);
      code.push(...unsignedLEB128(state.controlDepth - ctx.blockDepth));
      break;
    }

    /* ---------- CONTINUE ---------- */
    case "continueStatement": {
      if (state.loopStack.length === 0) {
        throw new Error("continue used outside of loop");
      }

      const ctx = state.loopStack[state.loopStack.length - 1];
      code.push(Opcode.br);
      code.push(...unsignedLEB128(state.controlDepth - ctx.loopDepth));
      break;
    }

    /* ---------- RETURN ---------- */
    case "returnStatement": {
      if (!state.inFunction) throw new Error("return used outside of function");
      const valueType = emitExpression(stmt.value, code, state);
      emitConversion(code, valueType, "f32");
      code.push(Opcode.return_);
      break;
    }

    case "setpixelStatement":
    case "setpixelrgbStatement": {
      // Evaluate operands once, left to right; cache values before bounds checks.
      const operands = stmt.type === "setpixelStatement"
        ? [stmt.x, stmt.y, stmt.value]
        : [stmt.x, stmt.y, stmt.r, stmt.g, stmt.b];
      const locals = operands.map((operand) => {
        const type = emitExpression(operand, code, state);
        emitConversion(code, type, "i32");
        const index = allocateLocal(state, "i32");
        code.push(Opcode.set_local, ...unsignedLEB128(index));
        return index;
      });
      const get = (index: number) => code.push(Opcode.get_local, ...unsignedLEB128(index));
      code.push(Opcode.block, BlockType.void);
      for (const [index, limit] of [[locals[0], state.width], [locals[1], state.height]]) {
        get(index);
        code.push(Opcode.i32_const, ...signedLEB128(0), Opcode.i32_lt_s, Opcode.br_if, 0);
        get(index);
        code.push(Opcode.i32_const, ...signedLEB128(limit), Opcode.i32_ge_s, Opcode.br_if, 0);
      }
      const address = allocateLocal(state, "i32");
      get(locals[1]);
      code.push(Opcode.i32_const, ...signedLEB128(state.width), Opcode.i32_mul);
      get(locals[0]);
      code.push(Opcode.i32_add, Opcode.i32_const, ...signedLEB128(4), Opcode.i32_mul);
      code.push(Opcode.set_local, ...unsignedLEB128(address));
      for (let channel = 0; channel < 4; channel++) {
        get(address);
        if (channel === 3) code.push(Opcode.i32_const, ...signedLEB128(255));
        else get(stmt.type === "setpixelStatement" ? locals[2] : locals[channel + 2]);
        code.push(Opcode.i32_store8, 0, channel);
      }
      code.push(Opcode.end);
      break;
    }

    default:
      throw new Error("Unknown statement");
  }
}

/* ---------- EMITTER ---------- */

export function emitter(ast: Program, options: EmitterOptions = {}): Uint8Array {
  const state = createState();
  state.width = options.width ?? CANVAS_WIDTH;
  state.height = options.height ?? CANVAS_HEIGHT;
  for (const dimension of [state.width, state.height]) {
    if (!Number.isInteger(dimension) || dimension < 1 || dimension > 500) throw new Error("Canvas dimensions must be integers between 1 and 500");
  }
  
  // Separate function declarations from statements
  const functions: FunctionDeclarationNode[] = [];
  const statements: StatementNode[] = [];
  
  for (const node of ast) {
    if (node.type === "functionDeclaration") {
      functions.push(node as FunctionDeclarationNode);
    } else {
      statements.push(node);
    }
  }
  
  // Pass 1: Register all functions
  let nextFuncIndex = RUN_FUNC_INDEX + 1; // run is at RUN_FUNC_INDEX
  for (const func of functions) {
    if (state.functions.has(func.name)) throw new Error(`Duplicate function '${func.name}'`);
    if (new Set(func.params).size !== func.params.length) throw new Error(`Duplicate parameter in '${func.name}'`);
    state.functions.set(func.name, {
      index: nextFuncIndex++,
      paramCount: func.params.length,
      params: func.params,
      body: func.body,
    });
  }
  
  // Pass 2a: Emit run function body
  state.scopes = [];
  state.localCount = 0;
  state.localTypes = [];
  state.controlDepth = 0;
  state.loopStack = [];
  state.inFunction = false;
  enterScope(state);

  const runCode: number[] = [];
  for (const stmt of statements) {
    emitStatement(stmt, runCode, state);
  }

  exitScope(state);
  const runLocalTypes = [...state.localTypes];

  // Pass 2b: Emit user function bodies
  const userFuncBodies: { code: number[]; localTypes: ValueType[]; paramCount: number }[] = [];
  
  for (const func of functions) {
    const funcInfo = state.functions.get(func.name)!;
    
    // Reset state for this function
    resetForFunction(state, funcInfo.paramCount);
    enterScope(state);
    
    // Register params as locals (indices 0..paramCount-1)
    for (let i = 0; i < funcInfo.params.length; i++) {
      state.scopes[0].set(funcInfo.params[i], { index: i, type: "f32" });
    }
    
    const funcCode: number[] = [];
    for (const stmt of funcInfo.body) {
      emitStatement(stmt, funcCode, state);
    }
    
    // A fallback after an explicit return is unreachable but valid WASM.
    funcCode.push(Opcode.f32_const, ...f32(0), Opcode.return_);

    exitScope(state);
    
    userFuncBodies.push({
      code: funcCode,
      localTypes: [...state.localTypes],
      paramCount: funcInfo.paramCount,
    });
  }

  // Build type section
  const runType = [FUNC_TYPE, 0x00, 0x00]; // () -> void

  const printF32Type = [
    FUNC_TYPE,
    ...unsignedLEB128(1),
    ValType.f32,
    0x00,
  ];

  const printI32Type = [
    FUNC_TYPE,
    ...unsignedLEB128(1),
    ValType.i32,
    0x00,
  ];

  // User function types: (f32, f32, ...) -> f32
  const userFuncTypes: number[][] = [];
  for (const func of functions) {
    const paramCount = func.params.length;
    userFuncTypes.push([
      FUNC_TYPE,
      ...unsignedLEB128(paramCount),
      ...Array(paramCount).fill(ValType.f32),
      ...unsignedLEB128(1),
      ValType.f32,
    ]);
  }

  const typeSection = createSection(
    Section.Type,
    encodeVector([runType, printF32Type, printI32Type, ...userFuncTypes])
  );

  const importSection = createSection(
    Section.Import,
    encodeVector([
      [
        ...encodeString("env"),
        ...encodeString("print_f32"),
        ExportKind.func,
        ...unsignedLEB128(1),
      ],
      [
        ...encodeString("env"),
        ...encodeString("print_i32"),
        ExportKind.func,
        ...unsignedLEB128(2),
      ],
    ])
  );

  // Calculate pages needed: RGBA = 4 bytes/pixel, page = 64KB
  // For 500x500 canvas: 500*500*4 = 1,000,000 bytes = ~16 pages
  const pixelBytes = state.width * state.height * 4;
  const pagesNeeded = Math.ceil(pixelBytes / 65536);
  const memoryPages = Math.max(1, pagesNeeded);
  
  const memorySection = createSection(
    Section.Memory,
    encodeVector([
      [
        0x00,                        // flags: min only
        ...unsignedLEB128(memoryPages) // dynamically sized
      ],
    ])
  );

  // Function section: run + user functions
  const funcTypeIndices: number[][] = [[...unsignedLEB128(0)]]; // run uses type 0
  for (let i = 0; i < functions.length; i++) {
    funcTypeIndices.push([...unsignedLEB128(3 + i)]); // user funcs use type 3+i
  }

  const funcSection = createSection(
    Section.Function,
    encodeVector(funcTypeIndices)
  );

  const exportSection = createSection(
    Section.Export,
    encodeVector([
      [...encodeString("run"), ExportKind.func, ...unsignedLEB128(RUN_FUNC_INDEX)],
      [...encodeString("memory"), ExportKind.memory, ...unsignedLEB128(0)],
    ])
  );

  // Build code section
  const runLocals = encodeLocalDeclarations(runLocalTypes);

  const runBody = [
    ...encodeVector(runLocals),
    ...runCode,
    Opcode.end,
  ];

  const codeBodies: number[][] = [
    [...unsignedLEB128(runBody.length), ...runBody]
  ];

  for (const funcBody of userFuncBodies) {
    const locals = encodeLocalDeclarations(funcBody.localTypes);
    
    const body = [
      ...encodeVector(locals),
      ...funcBody.code,
      Opcode.end,
    ];
    
    codeBodies.push([...unsignedLEB128(body.length), ...body]);
  }

  const codeSection = createSection(
    Section.Code,
    encodeVector(codeBodies)
  );

  return Uint8Array.from([
    ...MAGIC,
    ...VERSION,
    ...typeSection,
    ...importSection,
    ...funcSection,
    ...memorySection,
    ...exportSection,
    ...codeSection,
  ]);
}
