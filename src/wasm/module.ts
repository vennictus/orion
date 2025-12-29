import {
  Section,
  ValType,
  Opcode,
  ExportKind,
  FUNC_TYPE,
} from "./constants";

import { unsignedLEB128, encodeString, f32 } from "./encoding";
import { Program } from "../types/parser";

/* ---------- WASM HEADERS ---------- */

const MAGIC = [0x00, 0x61, 0x73, 0x6d];
const VERSION = [0x01, 0x00, 0x00, 0x00];

/* ---------- HELPERS ---------- */

function encodeVector(entries: number[][]): number[] {
  return [
    ...unsignedLEB128(entries.length),
    ...entries.flat(),
  ];
}

function createSection(section: Section, payload: number[]): number[] {
  return [
    section,
    ...unsignedLEB128(payload.length),
    ...payload,
  ];
}

/* ---------- EMITTER ---------- */

export function emitter(ast: Program): Uint8Array {

  /* ---------- AST → CODE ---------- */

  function codeFromAst(ast: Program): number[] {
    const code: number[] = [];

    for (const stmt of ast) {
      if (stmt.type === "printStatement") {
        const expr = stmt.expression;

        if (expr.type === "numberLiteral") {
          code.push(Opcode.f32_const);
          code.push(...f32(expr.value));

          code.push(Opcode.call);
          code.push(...unsignedLEB128(0)); // env.print
        }
      }
    }

    return code;
  }

  /* ---------- TYPE SECTION ---------- */

  // type 0: run() -> void
  const runType = [
    FUNC_TYPE,
    ...unsignedLEB128(0),
    ...unsignedLEB128(0),
  ];

  // type 1: print(f32) -> void
  const printType = [
    FUNC_TYPE,
    ...unsignedLEB128(1),
    ValType.f32,
    ...unsignedLEB128(0),
  ];

  const typeSection = createSection(
    Section.Type,
    encodeVector([runType, printType])
  );

  /* ---------- IMPORT SECTION ---------- */

  const printImport = [
    ...encodeString("env"),
    ...encodeString("print"),
    ExportKind.func,
    ...unsignedLEB128(1), // type index = printType
  ];

  const importSection = createSection(
    Section.Import,
    encodeVector([printImport])
  );

  /* ---------- FUNCTION SECTION ---------- */

  const funcSection = createSection(
    Section.Function,
    encodeVector([
      [...unsignedLEB128(0)] // run uses type 0
    ])
  );

  /* ---------- EXPORT SECTION ---------- */

  const exportEntry = [
    ...encodeString("run"),
    ExportKind.func,
    ...unsignedLEB128(1), // run is function index 1
  ];

  const exportSection = createSection(
    Section.Export,
    encodeVector([exportEntry])
  );

  /* ---------- CODE SECTION ---------- */

  const body = [
    ...unsignedLEB128(0), // locals
    ...codeFromAst(ast),
    Opcode.end,
  ];

  const codeSection = createSection(
    Section.Code,
    encodeVector([
      [
        ...unsignedLEB128(body.length),
        ...body,
      ],
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
