// src/wasm/encode.ts
import { unsignedLEB128 } from "./leb128";

export function encodeVector(data: number[]): number[] {
  return [
    ...unsignedLEB128(data.length),
    ...data,
  ];
}
