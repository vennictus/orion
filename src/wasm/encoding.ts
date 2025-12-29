// unsigned LEB128
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

// Encode a WASM string
export function encodeString(str: string): number[] {
  const bytes = Array.from(Buffer.from(str, "utf8"));
  return [...unsignedLEB128(bytes.length), ...bytes];
}
