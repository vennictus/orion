// src/wasm/leb128.ts

export function unsignedLEB128(value: number): number[] {
  const bytes: number[] = [];

  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (value !== 0);

  return bytes;
}
