// src/wasm/module.ts

import {
  Section,
  ValType,
  Opcode,
  ExportKind,
  FUNC_TYPE,
} from "./constants";

import { f32, unsignedLEB128, signedLEB128, encodeString } from "./encoding";

import { Program } from "../types/parser";

/* ---------- WASM HEADERS ---------- */

const MAGIC = [0x00, 0x61, 0x73, 0x6d];
const VERSION = [0x01, 0x00, 0x00, 0x00];

/* ---------- HELPERS ---------- */

function encodeVector(entries: number[][]): number[] {
  return [...unsignedLEB128(entries.length), ...entries.flat()];
}

function createSection(section: Section, payload: number[]): number[] {
  return [section, ...unsignedLEB128(payload.length), ...payload];
}

/* ---------- TYPES ---------- */

type ValueType = "f32" | "i32";

/* ---------- OPCODE MAP ---------- */

const binaryOpcode: Record<string, { opcode: Opcode; result: ValueType }> = {
  "+": { opcode: Opcode.f32_add, result: "f32" },
  "-": { opcode: Opcode.f32_sub, result: "f32" },
  "*": { opcode: Opcode.f32_mul, result: "f32" },
  "/": { opcode: Opcode.f32_div, result: "f32" },

  "==": { opcode: Opcode.f32_eq, result: "i32" },
  "<": { opcode: Opcode.f32_lt, result: "i32" },
  ">": { opcode: Opcode.f32_gt, result: "i32" },
  "&&": { opcode: Opcode.i32_and, result: "i32" },
};

/* ---------- SCOPE STACK ---------- */

type Scope = Map<string, number>;

const scopes: Scope[] = [];
let localCount = 0;

function enterScope() {
  scopes.push(new Map());
}

function exitScope() {
  scopes.pop();
}

function declareSymbol(name: string): number {
  const index = localCount++;
  scopes[scopes.length - 1].set(name, index);
  return index;
}

function resolveSymbol(name: string): number {
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i];
    if (scope.has(name)) {
      return scope.get(name)!;
    }
  }
  throw new Error(`Undefined variable '${name}'`);
}

/* ---------- EXPRESSION EMITTER ---------- */

function emitExpression(node: any, code: number[]): ValueType {
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
      const index = resolveSymbol(node.name);
      code.push(Opcode.get_local);
      code.push(...unsignedLEB128(index));
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
        operator === "<" ||
        operator === ">";

      const isLogical = operator === "&&";

      const leftType = emitExpression(node.left, code);
      if ((isArithmetic || isComparison) && leftType === "i32") {
        code.push(Opcode.f32_convert_i32_s);
      }

      const rightType = emitExpression(node.right, code);
      if ((isArithmetic || isComparison) && rightType === "i32") {
        code.push(Opcode.f32_convert_i32_s);
      }

      if (isLogical) {
        if (leftType !== "i32" || rightType !== "i32") {
          throw new Error("Operator && requires i32 operands");
        }
      }

      code.push(entry.opcode);
      return entry.result;
    }
  }

  throw new Error(`Unknown expression type '${node.type}'`);
}

/* ---------- STATEMENT EMITTER ---------- */

function emitStatement(stmt: any, code: number[]) {
  switch (stmt.type) {
    case "printStatement": {
      const type = emitExpression(stmt.expression, code);
      code.push(Opcode.call);
      code.push(...unsignedLEB128(type === "f32" ? 0 : 1));
      break;
    }

    case "variableDeclaration": {
      const valueType = emitExpression(stmt.initializer, code);

      if (valueType === "i32") {
        code.push(Opcode.f32_convert_i32_s);
      }

      const index = declareSymbol(stmt.name);
      code.push(Opcode.set_local);
      code.push(...unsignedLEB128(index));
      break;
    }

    case "assignmentStatement": {
      const index = resolveSymbol(stmt.name);
      const valueType = emitExpression(stmt.value, code);

      if (valueType === "i32") {
        code.push(Opcode.f32_convert_i32_s);
      }

      code.push(Opcode.set_local);
      code.push(...unsignedLEB128(index));
      break;
    }

    case "blockStatement": {
      enterScope();
      for (const inner of stmt.body) {
        emitStatement(inner, code);
      }
      exitScope();
      break;
    }

    /* ---------- IF STATEMENT ---------- */
    case "ifStatement": {
      code.push(Opcode.block);
      code.push(0x40);

      code.push(Opcode.block);
      code.push(0x40);

      const condType = emitExpression(stmt.condition, code);
      if (condType !== "i32") {
        throw new Error("if condition must be i32");
      }

      code.push(Opcode.i32_eqz);

      code.push(Opcode.br_if);
      code.push(...signedLEB128(0));

      enterScope();
      for (const inner of stmt.thenBlock) {
        emitStatement(inner, code);
      }
      exitScope();

      code.push(Opcode.br);
      code.push(...signedLEB128(1));

      code.push(Opcode.end);

      if (stmt.elseBlock) {
        enterScope();
        for (const inner of stmt.elseBlock) {
          emitStatement(inner, code);
        }
        exitScope();
      }

      code.push(Opcode.end);
      break;
    }

/* ---------- WHILE STATEMENT ---------- */
case "whileStatement": {

  // 🔥 SPECIAL CASE: empty body → single condition check
  if (stmt.body.length === 0) {

    // block to safely consume condition
    code.push(Opcode.block);
    code.push(0x40);

    const condType = emitExpression(stmt.condition, code);
    if (condType !== "i32") {
      throw new Error("while condition must be i32");
    }

    // negate condition
    code.push(Opcode.i32_eqz);

    // exit block immediately
    code.push(Opcode.br_if);
    code.push(...signedLEB128(0));

    // end block
    code.push(Opcode.end);

    break;
  }

  // ===============================
  // NORMAL WHILE LOOP (UNCHANGED)
  // ===============================

  // outer block (exit target)
  code.push(Opcode.block);
  code.push(0x40);

  // inner loop (repeat target)
  code.push(Opcode.loop);
  code.push(0x40);

  const condType = emitExpression(stmt.condition, code);
  if (condType !== "i32") {
    throw new Error("while condition must be i32");
  }

  code.push(Opcode.i32_eqz);

  // if false → break out of block
  code.push(Opcode.br_if);
  code.push(...signedLEB128(1));

  // --- loop body ---
  enterScope();
  for (const inner of stmt.body) {
    emitStatement(inner, code);
  }
  exitScope();

  // jump back to loop start
  code.push(Opcode.br);
  code.push(...signedLEB128(0));

  code.push(Opcode.end); // loop
  code.push(Opcode.end); // block

  break;
}

  }
}
/* ---------- EMITTER ---------- */

export function emitter(ast: Program): Uint8Array {
  enterScope();

  const code: number[] = [];
  for (const stmt of ast) {
    emitStatement(stmt, code);
  }

  exitScope();

  const runType = [FUNC_TYPE, 0x00, 0x00];

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

  const typeSection = createSection(
    Section.Type,
    encodeVector([runType, printF32Type, printI32Type])
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

  const funcSection = createSection(
    Section.Function,
    encodeVector([[...unsignedLEB128(0)]])
  );

  const exportSection = createSection(
    Section.Export,
    encodeVector([
      [...encodeString("run"), ExportKind.func, ...unsignedLEB128(2)],
    ])
  );

  const locals =
    localCount === 0
      ? []
      : [[...unsignedLEB128(localCount), ValType.f32]];

  const body = [
    ...encodeVector(locals),
    ...code,
    Opcode.end,
  ];

  const codeSection = createSection(
    Section.Code,
    encodeVector([[...unsignedLEB128(body.length), ...body]])
  );

  return Uint8Array.from([
    ...MAGIC,
    ...VERSION,
    ...typeSection,
    ...importSection,
    ...funcSection,
    ...exportSection,
    ...codeSection,
  ]);
}
