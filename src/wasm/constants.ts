// WASM section ids
export enum Section {
  Type = 0x01,
  Function = 0x03,
  Export = 0x07,
  Code = 0x0a,
}

// Value types
export enum ValType {
  i32 = 0x7f,
  f32 = 0x7d,
}

// Opcodes
export enum Opcode {
  call = 0x10,       // NEW (needed for print)
  get_local = 0x20,
  f32_const = 0x43,  // NEW (needed for numberLiteral)
  f32_add = 0x92,
  end = 0x0b,
}

// Export kinds
export enum ExportKind {
  func = 0x00,
}

// Function type marker
export const FUNC_TYPE = 0x60;

