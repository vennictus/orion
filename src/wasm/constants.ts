// src/wasm/constants.ts

/* ---------- SECTIONS ---------- */
export enum Section {
  Type = 0x01,
  Import = 0x02,
  Function = 0x03,
  Memory = 0x05,
  Export = 0x07,
  Code = 0x0a,
}

/* ---------- VALUE TYPES ---------- */
export enum ValType {
  i32 = 0x7f,
  f32 = 0x7d,
}

/* ---------- EXPORT KINDS ---------- */
export enum ExportKind {
  func = 0x00,
  memory = 0x02,
}

/* ---------- FUNCTION TYPE ---------- */
export const FUNC_TYPE = 0x60;

/* ---------- OPCODES (SINGLE ENUM, NO DUPLICATES) ---------- */
export enum Opcode {
  /* control */
  block = 0x02,
  loop = 0x03,
  br = 0x0c,
  br_if = 0x0d,
  call = 0x10,
  end = 0x0b,

  /* locals */
  get_local = 0x20,
  set_local = 0x21,

  /* constants */
  i32_const = 0x41,
  f32_const = 0x43,

  /* comparisons */
  i32_eqz = 0x45,
  f32_eq = 0x5b,
  f32_lt = 0x5d,
  f32_gt = 0x5e,

  /* logical */
  i32_and = 0x71,

  /* arithmetic */
  i32_add = 0x6a,
  i32_mul = 0x6c,
  f32_add = 0x92,
  f32_sub = 0x93,
  f32_mul = 0x94,
  f32_div = 0x95,

  /* conversions */
  i32_trunc_f32_s = 0xa8,
  f32_convert_i32_s = 0xb2,

  /* memory */
  i32_store8 = 0x3a,
}

/* ---------- BLOCK TYPES ---------- */
export enum BlockType {
  void = 0x40,
}
