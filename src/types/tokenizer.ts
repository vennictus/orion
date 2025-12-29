// src/types/tokenizer.ts

export type TokenType =
  | "keyword"
  | "number"
  | "whitespace";

export interface Token {
  type: TokenType;
  value: string;
  line?: number;
  char?: number;
}

export interface Tokenizer {
  (input: string): Token[];
}

export interface Matcher {
  (input: string, index: number): Token | null;
}
