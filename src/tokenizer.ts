// src/tokenizer.ts

import { Token, Tokenizer, TokenType, Matcher } from "./types/tokenizer";

/* ---------- LANGUAGE DEFINITIONS ---------- */

// supported keywords
// src/tokenizer.ts

export const keywords = [
  "print",
  "let",
  "if",
  "else",
  "end",
  "while",
  "break",
  "continue",
  "setpixel", // 👈 add this
];


// supported operators
export const operators = ["+", "-", "*", "/", "==", "<", ">", "&&"];

// identifiers: variable names
const identifierRegex = "^[a-zA-Z_][a-zA-Z0-9_]*";

/* ---------- HELPERS ---------- */

/**
 * Escape operators for regex ( +, *, etc are special chars )
 */
const escapeRegEx = (text: string) =>
  text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

/**
 * Returns a token if regex matches at the current index
 */
const regexMatcher =
  (regex: string, type: TokenType): Matcher =>
  (input: string, index: number) => {
    const match = input.substring(index).match(regex);
    return (
      match && {
        type,
        value: match[0],
      }
    );
  };

/* ---------- MATCHERS ---------- */
/* ⚠️ ORDER MATTERS (highest priority first) */

const matchers: Matcher[] = [
  regexMatcher("^[0-9]+(\\.[0-9]+)?", "number"),

  regexMatcher(`^(${keywords.join("|")})`, "keyword"),

  regexMatcher(identifierRegex, "identifier"),

  regexMatcher(`^(${operators.map(escapeRegEx).join("|")})`, "operator"),

  // grouping tokens: ( ) { } =
  regexMatcher("^[(){}=]", "parens"),

  regexMatcher("^\\s+", "whitespace"),
];

/* ---------- TOKENIZER ---------- */

export const tokenize: Tokenizer = (input) => {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const matches = matchers
      .map((m) => m(input, index))
      .filter(Boolean) as Token[];

    if (matches.length === 0) {
      throw new Error(
        `Unexpected token '${input[index]}' at position ${index}`
      );
    }

    const match = matches[0];

    if (match.type !== "whitespace") {
      tokens.push(match);
    }

    index += match.value.length;
  }

  return tokens;
};
