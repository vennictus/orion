import { unsignedLEB128 } from "./leb128";

// WASM headers
const MAGIC = [0x00, 0x61, 0x73, 0x6d];
const VERSION = [0x01, 0x00, 0x00, 0x00];

// Section IDs
const SECTION_TYPE = 0x01;
const SECTION_FUNCTION = 0x03;
const SECTION_EXPORT = 0x07;
const SECTION_CODE = 0x0a;

// Value types
const F32 = 0x7d;

// Opcodes
const GET_LOCAL = 0x20;
const F32_ADD = 0x92;
const END = 0x0b;

// Create a WASM section
function createSection(id: number, payload: number[]): number[] {
  return [
    id,
    ...unsignedLEB128(payload.length),
    ...payload,
  ];
}

export function emitter(): Uint8Array {
  /* ---------- TYPE SECTION ---------- */
  const funcType = [
    0x60,                  // func
    ...unsignedLEB128(2),  // param count
    F32, F32,              // param types
    ...unsignedLEB128(1),  // result count
    F32,                   // result type
  ];

  const typeSection = createSection(
    SECTION_TYPE,
    [
      ...unsignedLEB128(1), // ✅ one function type
      ...funcType,
    ]
  );

  /* ---------- FUNCTION SECTION ---------- */
  const functionSection = createSection(
    SECTION_FUNCTION,
    [
      ...unsignedLEB128(1), // one function
      ...unsignedLEB128(0), // uses type 0
    ]
  );

  /* ---------- EXPORT SECTION ---------- */
  const exportName = Array.from(Buffer.from("add"));

  const exportSection = createSection(
    SECTION_EXPORT,
    [
      ...unsignedLEB128(1),              // one export
      ...unsignedLEB128(exportName.length),
      ...exportName,
      0x00,                              // export kind: function
      ...unsignedLEB128(0),              // function index
    ]
  );

  /* ---------- CODE SECTION ---------- */
  const functionBody = [
    ...unsignedLEB128(0), // locals count
    GET_LOCAL, ...unsignedLEB128(0),
    GET_LOCAL, ...unsignedLEB128(1),
    F32_ADD,
    END,
  ];

  const codeSection = createSection(
    SECTION_CODE,
    [
      ...unsignedLEB128(1),              // one function body
      ...unsignedLEB128(functionBody.length),
      ...functionBody,
    ]
  );

  return Uint8Array.from([
    ...MAGIC,
    ...VERSION,
    ...typeSection,
    ...functionSection,
    ...exportSection,
    ...codeSection,
  ]);
}
