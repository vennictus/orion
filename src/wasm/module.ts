// src/wasm/module.ts

/**
 * WebAssembly binary format:
 * https://webassembly.github.io/spec/core/binary/modules.html
 *
 * A valid WASM module must start with:
 *  - Magic header: \0asm
 *  - Version: 1 (little-endian)
 */

// \0asm
const MAGIC_HEADER = [0x00, 0x61, 0x73, 0x6d];

// WASM version 1
const VERSION = [0x01, 0x00, 0x00, 0x00];

/**
 * Emits the smallest valid WebAssembly module.
 * No sections, no code — just enough to be instantiated.
 */
export function emitter(): Uint8Array {
  const buffer = [
    ...MAGIC_HEADER,
    ...VERSION,
  ];

  return Uint8Array.from(buffer);
}
