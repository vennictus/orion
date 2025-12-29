import {
  Section,
  ValType,
  Opcode,
  ExportKind,
  FUNC_TYPE,
} from "./constants";
import { unsignedLEB128, encodeString } from "./encoding";

// WASM headers
const MAGIC = [0x00, 0x61, 0x73, 0x6d];
const VERSION = [0x01, 0x00, 0x00, 0x00];

// Encode a vector of entries
function encodeVector(entries: number[][]): number[] {
  return [
    ...unsignedLEB128(entries.length),
    ...entries.flat(),
  ];
}

// Create a section
function createSection(section: Section, payload: number[]): number[] {
  return [
    section,
    ...unsignedLEB128(payload.length),
    ...payload,
  ];
}

export function emitter(): Uint8Array {
  /* ---------- TYPE SECTION ---------- */
  const addType = [
    FUNC_TYPE,
    ...unsignedLEB128(2),
    ValType.f32,
    ValType.f32,
    ...unsignedLEB128(1),
    ValType.f32,
  ];

  const typeSection = createSection(
    Section.Type,
    encodeVector([addType])
  );

  /* ---------- FUNCTION SECTION ---------- */
  const funcSection = createSection(
    Section.Function,
    encodeVector([[...unsignedLEB128(0)]])
  );

  /* ---------- EXPORT SECTION ---------- */
  const exportEntry = [
    ...encodeString("add"),
    ExportKind.func,
    ...unsignedLEB128(0),
  ];

  const exportSection = createSection(
    Section.Export,
    encodeVector([exportEntry])
  );

  /* ---------- CODE SECTION ---------- */
  const body = [
    ...unsignedLEB128(0), // locals
    Opcode.get_local,
    ...unsignedLEB128(0),
    Opcode.get_local,
    ...unsignedLEB128(1),
    Opcode.f32_add,
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

  return Uint8Array.from([
    ...MAGIC,
    ...VERSION,
    ...typeSection,
    ...funcSection,
    ...exportSection,
    ...codeSection,
  ]);
}
