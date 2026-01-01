// src/wasm/constants.ts

export enum Section {
  Type = 0x01,
  Import = 0x02,
  Function = 0x03,
  Export = 0x07,
  Code = 0x0a,
}

export enum ValType {
  i32 = 0x7f,
  f32 = 0x7d,
}

export enum Opcode {
  /* ---------- CONTROL ---------- */
  call = 0x10,
  end = 0x0b,

  /* ---------- LOCALS ---------- */
  get_local = 0x20,
  set_local = 0x21,

  /* ---------- CONSTANTS ---------- */
  i32_const = 0x41,
  f32_const = 0x43,

  /* ---------- ARITHMETIC (f32) ---------- */
  f32_add = 0x92,
  f32_sub = 0x93,
  f32_mul = 0x94,
  f32_div = 0x95,

  /* ---------- COMPARISONS (result i32) ---------- */
  f32_eq = 0x5b,
  f32_lt = 0x5d,
  f32_gt = 0x5e,

  /* ---------- LOGICAL ---------- */
  i32_and = 0x71,

  /* ---------- CONVERSIONS ---------- */
  f32_convert_i32_s = 0xb2,
}

export enum ExportKind {
  func = 0x00,
}

export const FUNC_TYPE = 0x60;


export enum Opcode {
  // control
  block = 0x02,
  loop = 0x03,
  br = 0x0c,
  br_if = 0x0d,

  // comparisons
  i32_eqz = 0x45,

  // existing...
  
}


export enum BlockType {
  void = 0x40,
}
