// src/wasm/module.ts
import {
  Section,
  ValType,
  Opcode,
  ExportKind,
  FUNC_TYPE,
} from "./constants";

import { f32, unsignedLEB128, encodeString } from "./encoding";
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

/* ---------- OPCODE MAP ---------- */

type ValueType = "f32" | "i32";

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

/* ---------- EMITTER ---------- */

export function emitter(ast: Program): Uint8Array {
  /* ---------- LOCALS ---------- */

  const locals = new Map<string, { index: number; type: ValueType }>();
  let localIndex = 0;

  /* ---------- EXPRESSIONS ---------- */

  function emitExpression(node: any, code: number[]): ValueType {
    switch (node.type) {
      case "numberLiteral": {
        if (Number.isInteger(node.value)) {
          code.push(Opcode.i32_const);
          code.push(...unsignedLEB128(node.value));
          return "i32";
        } else {
          code.push(Opcode.f32_const);
          code.push(...f32(node.value));
          return "f32";
        }
      }

      case "identifier": {
        const entry = locals.get(node.name);
        if (!entry) {
          throw new Error(`Undefined variable '${node.name}'`);
        }

        code.push(Opcode.get_local);
        code.push(...unsignedLEB128(entry.index));
        return entry.type;
      }

      case "binaryExpression": {
        const entry = binaryOpcode[node.operator];
        const isArithmetic = ["+", "-", "*", "/"].includes(node.operator);
        const isComparison = ["==", "<", ">"].includes(node.operator);

        const leftType = emitExpression(node.left, code);
        if ((isArithmetic || isComparison) && leftType === "i32") {
          code.push(Opcode.f32_convert_i32_s);
        }

        const rightType = emitExpression(node.right, code);
        if ((isArithmetic || isComparison) && rightType === "i32") {
          code.push(Opcode.f32_convert_i32_s);
        }

        if (node.operator === "&&") {
          if (leftType !== "i32" || rightType !== "i32") {
            throw new Error("Operator && requires i32 operands");
          }
        }

        code.push(entry.opcode);
        return entry.result;
      }
    }

    throw new Error(`Unknown expression type ${node.type}`);
  }

  /* ---------- STATEMENTS ---------- */

  function codeFromAst(ast: Program): number[] {
    const code: number[] = [];

    for (const stmt of ast) {
      if (stmt.type === "variableDeclaration") {
        const valueType = emitExpression(stmt.initializer, code);

        const index = localIndex++;
        locals.set(stmt.name, { index, type: valueType });

        code.push(Opcode.set_local);
        code.push(...unsignedLEB128(index));
        continue;
      }

      if (stmt.type === "printStatement") {
        const exprType = emitExpression(stmt.expression, code);

        code.push(Opcode.call);
        code.push(...unsignedLEB128(exprType === "f32" ? 0 : 1));
      }
    }

    return code;
  }

  const instructions = codeFromAst(ast);

  /* ---------- LOCAL DECLARATIONS ---------- */

  const i32Count = [...locals.values()].filter(l => l.type === "i32").length;
  const f32Count = [...locals.values()].filter(l => l.type === "f32").length;

  const body: number[] = [];

  if (i32Count === 0 && f32Count === 0) {
    body.push(...unsignedLEB128(0));
  } else {
    let groups = 0;
    const localsDecl: number[] = [];

    if (i32Count > 0) {
      groups++;
      localsDecl.push(...unsignedLEB128(i32Count), ValType.i32);
    }

    if (f32Count > 0) {
      groups++;
      localsDecl.push(...unsignedLEB128(f32Count), ValType.f32);
    }

    body.push(...unsignedLEB128(groups), ...localsDecl);
  }

  body.push(...instructions, Opcode.end);

  /* ---------- TYPE SECTION ---------- */

  const runType = [
    FUNC_TYPE,
    ...unsignedLEB128(0),
    ...unsignedLEB128(0),
  ];

  const printF32Type = [
    FUNC_TYPE,
    ...unsignedLEB128(1),
    ValType.f32,
    ...unsignedLEB128(0),
  ];

  const printI32Type = [
    FUNC_TYPE,
    ...unsignedLEB128(1),
    ValType.i32,
    ...unsignedLEB128(0),
  ];

  const typeSection = createSection(
    Section.Type,
    encodeVector([runType, printF32Type, printI32Type])
  );

  /* ---------- IMPORT SECTION ---------- */

  const importSection = createSection(
    Section.Import,
    encodeVector([
      [...encodeString("env"), ...encodeString("print_f32"), ExportKind.func, ...unsignedLEB128(1)],
      [...encodeString("env"), ...encodeString("print_i32"), ExportKind.func, ...unsignedLEB128(2)],
    ])
  );

  /* ---------- FUNCTION SECTION ---------- */

  const funcSection = createSection(
    Section.Function,
    encodeVector([[...unsignedLEB128(0)]])
  );

  /* ---------- EXPORT SECTION ---------- */

  const exportSection = createSection(
    Section.Export,
    encodeVector([
      [...encodeString("run"), ExportKind.func, ...unsignedLEB128(2)],
    ])
  );

  /* ---------- CODE SECTION ---------- */

  const codeSection = createSection(
    Section.Code,
    encodeVector([
      [...unsignedLEB128(body.length), ...body],
    ])
  );

  /* ---------- MODULE ---------- */

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
