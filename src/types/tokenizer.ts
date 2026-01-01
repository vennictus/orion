// src/types/tokenizer.ts

export type TokenType =
  | "number"
  | "keyword"
  | "identifier"
  | "operator"
  | "parens"
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


export const keywords = [
  "print",
  "let",
  "if",
  "else",
  "end",
];
