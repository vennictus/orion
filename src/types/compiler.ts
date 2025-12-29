// src/types/compiler.ts

export interface Compiler {
  (src: string): Uint8Array;
}
