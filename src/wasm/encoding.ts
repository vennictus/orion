// src/wasm/encoding.ts

export function unsignedLEB128(n: number): number[] {
  const out: number[] = [];
  do {
    let byte = n & 0x7f;
    n >>>= 7;
    if (n !== 0) byte |= 0x80;
    out.push(byte);
  } while (n !== 0);
  return out;
}

export function signedLEB128(n: number): number[] {
  const out: number[] = [];
  let more = true;
  const isNegative = n < 0;

  while (more) {
    let byte = n & 0x7f;
    n >>= 7;

    if (
      (n === 0 && (byte & 0x40) === 0) ||
      (n === -1 && (byte & 0x40) !== 0)
    ) {
      more = false;
    } else {
      byte |= 0x80;
    }

    out.push(byte);
  }

  return out;
}


export function encodeString(str: string): number[] {
  const bytes = Array.from(Buffer.from(str, "utf8"));
  return [...unsignedLEB128(bytes.length), ...bytes];
}

export function f32(value: number): number[] {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setFloat32(0, value, true);
  return Array.from(new Uint8Array(buffer));
}
