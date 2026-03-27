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

import { Program, FunctionDeclarationNode, TopLevelNode } from "../types/parser";

/* ---------- WASM HEADERS ---------- */

const MAGIC = [0x00, 0x61, 0x73, 0x6d];
const VERSION = [0x01, 0x00, 0x00, 0x00];

/* ---------- SHARED CONSTANTS ---------- */

export const CANVAS_WIDTH = 100;
export const CANVAS_HEIGHT = 100;

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
  body: any[];
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

type Scope = Map<string, number>;

/* ---------- LOOP STACK ---------- */

type LoopContext = {
  blockDepth: number; // absolute control depth of the surrounding block
  loopDepth: number;  // absolute control depth of the loop
};

/* ---------- COMPILER STATE ---------- */

interface CompilerState {
  scopes: Scope[];
  localCount: number;
  controlDepth: number;
  loopStack: LoopContext[];
  functions: Map<string, FunctionInfo>;
  inFunction: boolean;
}

function createState(): CompilerState {
  return {
    scopes: [],
    localCount: 0,
    controlDepth: 0,
    loopStack: [],
    functions: new Map(),
    inFunction: false,
  };
}

function resetForFunction(state: CompilerState, paramCount: number) {
  state.scopes = [];
  state.localCount = paramCount;
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

function declareSymbol(state: CompilerState, name: string): number {
  const index = state.localCount++;
  state.scopes[state.scopes.length - 1].set(name, index);
  return index;
}

function resolveSymbol(state: CompilerState, name: string): number {
  for (let i = state.scopes.length - 1; i >= 0; i--) {
    const scope = state.scopes[i];
    if (scope.has(name)) {
      return scope.get(name)!;
    }
  }
  throw new Error(`Undefined variable '${name}'`);
}
 

/* ---------- EXPRESSION EMITTER ---------- */

function emitExpression(node: any, code: number[], state: CompilerState): ValueType {
  switch (node.type) {
    case "numberLiteral": {
      if (Number.isInteger(node.value)) {
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
      const index = resolveSymbol(state, node.name);
      code.push(Opcode.get_local);
      code.push(...unsignedLEB128(index));
      return "f32";
    }

    case "unaryExpression": {
      if (node.operator === "-") {
        // -x → 0 - x
        code.push(Opcode.f32_const);
        code.push(...f32(0));
        const operandType = emitExpression(node.operand, code, state);
        if (operandType === "i32") {
          code.push(Opcode.f32_convert_i32_s);
        }
        code.push(Opcode.f32_sub);
        return "f32";
      } else if (node.operator === "not") {
        const operandType = emitExpression(node.operand, code, state);
        if (operandType === "f32") {
          // f32 → i32 truthiness
          code.push(Opcode.f32_const);
          code.push(...f32(0));
          code.push(Opcode.f32_eq);
          code.push(Opcode.i32_eqz);
        }
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
      
      // Emit arguments
      for (const arg of node.args) {
        const argType = emitExpression(arg, code, state);
        if (argType === "i32") {
          code.push(Opcode.f32_convert_i32_s);
        }
      }
      
      // Call function
      code.push(Opcode.call);
      code.push(...unsignedLEB128(funcInfo.index));
      return "f32";
    }

    case "binaryExpression": {
      const operator = node.operator;
      const entry = binaryOpcode[operator];

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

      const leftType = emitExpression(node.left, code, state);
      if ((isArithmetic || isComparison) && leftType === "i32") {
        code.push(Opcode.f32_convert_i32_s);
      }
      // For logical &&/||, convert f32 to i32 (truthiness check)
      if (isLogical && leftType === "f32") {
        code.push(Opcode.f32_const);
        code.push(...f32(0));
        code.push(Opcode.f32_eq);
        code.push(Opcode.i32_eqz); // f32 != 0.0 → i32
      }

      const rightType = emitExpression(node.right, code, state);
      if ((isArithmetic || isComparison) && rightType === "i32") {
        code.push(Opcode.f32_convert_i32_s);
      }
      // For logical &&/||, convert f32 to i32 (truthiness check)
      if (isLogical && rightType === "f32") {
        code.push(Opcode.f32_const);
        code.push(...f32(0));
        code.push(Opcode.f32_eq);
        code.push(Opcode.i32_eqz); // f32 != 0.0 → i32
      }

      code.push(entry.opcode);
      return entry.result;
    }
  }

  throw new Error(`Unknown expression type '${node.type}'`);
}

/* ---------- STATEMENT EMITTER ---------- */
function emitStatement(stmt: any, code: number[], state: CompilerState) {
  switch (stmt.type) {

    case "printStatement": {
      const type = emitExpression(stmt.expression, code, state);
      code.push(Opcode.call);
      code.push(...unsignedLEB128(type === "f32" ? 0 : 1));
      break;
    }

    case "variableDeclaration": {
      const valueType = emitExpression(stmt.initializer, code, state);

      if (valueType === "i32") {
        code.push(Opcode.f32_convert_i32_s);
      }

      const index = declareSymbol(state, stmt.name);
      code.push(Opcode.set_local);
      code.push(...unsignedLEB128(index));
      break;
    }

    case "assignmentStatement": {
      const index = resolveSymbol(state, stmt.name);
      const valueType = emitExpression(stmt.value, code, state);

      if (valueType === "i32") {
        code.push(Opcode.f32_convert_i32_s);
      }

      code.push(Opcode.set_local);
      code.push(...unsignedLEB128(index));
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
      code.push(...signedLEB128(0));

      enterScope(state);
      for (const inner of stmt.thenBlock) {
        emitStatement(inner, code, state);
      }
      exitScope(state);

      code.push(Opcode.br);
      code.push(...signedLEB128(1));

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

      /* --- EMPTY BODY --- */
      if (stmt.body.length === 0) {
        code.push(Opcode.block);
        code.push(BlockType.void);
        state.controlDepth++;

        const condType = emitExpression(stmt.condition, code, state);
        if (condType !== "i32") {
          throw new Error("while condition must be i32");
        }

        code.push(Opcode.i32_eqz);
        code.push(Opcode.br_if);
        code.push(...signedLEB128(0));

        code.push(Opcode.end);
        state.controlDepth--;
        break;
      }

      /* --- NORMAL LOOP --- */

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
      if (condType !== "i32") {
        throw new Error("while condition must be i32");
      }

      code.push(Opcode.i32_eqz);
      code.push(Opcode.br_if);
      code.push(...signedLEB128(1));

      enterScope(state);
      for (const inner of stmt.body) {
        emitStatement(inner, code, state);
      }
      exitScope(state);

      code.push(Opcode.br);
      code.push(...signedLEB128(0));

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
      code.push(...signedLEB128(state.controlDepth - ctx.blockDepth));
      break;
    }

    /* ---------- CONTINUE ---------- */
    case "continueStatement": {
      if (state.loopStack.length === 0) {
        throw new Error("continue used outside of loop");
      }

      const ctx = state.loopStack[state.loopStack.length - 1];
      code.push(Opcode.br);
      code.push(...signedLEB128(state.controlDepth - ctx.loopDepth));
      break;
    }

    /* ---------- RETURN ---------- */
    case "returnStatement": {
      const valueType = emitExpression(stmt.value, code, state);
      if (valueType === "i32") {
        code.push(Opcode.f32_convert_i32_s);
      }
      code.push(Opcode.return_);
      break;
    }

    case "setpixelStatement": {
      // x
      const xType = emitExpression(stmt.x, code, state);
      if (xType === "f32") code.push(Opcode.i32_trunc_f32_s);

      // y
      const yType = emitExpression(stmt.y, code, state);
      if (yType === "f32") code.push(Opcode.i32_trunc_f32_s);

      // y * WIDTH
      code.push(Opcode.i32_const);
      code.push(...signedLEB128(CANVAS_WIDTH));
      code.push(Opcode.i32_mul);

      // + x
      code.push(Opcode.i32_add);

      // value
      const vType = emitExpression(stmt.value, code, state);
      if (vType === "f32") code.push(Opcode.i32_trunc_f32_s);

      // store byte
      code.push(Opcode.i32_store8);
      code.push(0x00); // align
      code.push(0x00); // offset

      break;
    }

    default:
      throw new Error(`Unknown statement ${stmt.type}`);
  }
}

/* ---------- EMITTER ---------- */

export function emitter(ast: Program): Uint8Array {
  const state = createState();
  
  // Separate function declarations from statements
  const functions: FunctionDeclarationNode[] = [];
  const statements: TopLevelNode[] = [];
  
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
  state.controlDepth = 0;
  state.loopStack = [];
  state.inFunction = false;
  enterScope(state);

  const runCode: number[] = [];
  for (const stmt of statements) {
    emitStatement(stmt, runCode, state);
  }

  exitScope(state);
  const runLocalCount = state.localCount;

  // Pass 2b: Emit user function bodies
  const userFuncBodies: { code: number[]; localCount: number; paramCount: number }[] = [];
  
  for (const func of functions) {
    const funcInfo = state.functions.get(func.name)!;
    
    // Reset state for this function
    resetForFunction(state, funcInfo.paramCount);
    enterScope(state);
    
    // Register params as locals (indices 0..paramCount-1)
    for (let i = 0; i < funcInfo.params.length; i++) {
      state.scopes[0].set(funcInfo.params[i], i);
    }
    
    const funcCode: number[] = [];
    for (const stmt of funcInfo.body) {
      emitStatement(stmt, funcCode, state);
    }
    
    // If function doesn't end with return, add default return 0
    if (funcCode.length === 0 || funcCode[funcCode.length - 1] !== Opcode.return_) {
      funcCode.push(Opcode.f32_const);
      funcCode.push(...f32(0));
      funcCode.push(Opcode.return_);
    }
    
    exitScope(state);
    
    userFuncBodies.push({
      code: funcCode,
      localCount: state.localCount - funcInfo.paramCount, // additional locals beyond params
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

  const memorySection = createSection(
    Section.Memory,
    encodeVector([
      [
        0x00,                // flags: min only
        ...unsignedLEB128(1) // initial = 1 page (64KB)
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
  const runLocals =
    runLocalCount === 0
      ? []
      : [[...unsignedLEB128(runLocalCount), ValType.f32]];

  const runBody = [
    ...encodeVector(runLocals),
    ...runCode,
    Opcode.end,
  ];

  const codeBodies: number[][] = [
    [...unsignedLEB128(runBody.length), ...runBody]
  ];

  for (const funcBody of userFuncBodies) {
    const locals =
      funcBody.localCount === 0
        ? []
        : [[...unsignedLEB128(funcBody.localCount), ValType.f32]];
    
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
