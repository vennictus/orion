// src/types/compiler.ts

export interface Compiler {
  (src: string, options?: { width?: number; height?: number }): Uint8Array;
}
