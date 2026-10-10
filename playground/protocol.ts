import type { Program } from "../src/types/parser";
import type { Token } from "../src/types/tokenizer";
import type { BinaryInspection } from "../src/wasm/inspect";

export const RUN_TIMEOUT_MS = 8000;
export const MAX_OUTPUT_LINES = 1000;
export const MAX_SOURCE_LENGTH = 100_000;
export type WorkerRequest = { source: string; width: number; height: number; execute: boolean };
export type WorkerResponse =
  | { type: "compiled"; tokens: Token[]; ast: Program; wasm: Uint8Array; inspection: BinaryInspection; compileMs: number; validationMs: number }
  | { type: "output"; values: number[]; truncated?: boolean }
  | { type: "complete"; pixels: ArrayBuffer; executionMs: number }
  | { type: "error"; message: string };
