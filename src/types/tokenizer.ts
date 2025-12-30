// src/types/tokenizer.ts

// after
export type TokenType =
  | "number"
  | "keyword"
  | "whitespace"
  | "parens"
  | "operator";


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
