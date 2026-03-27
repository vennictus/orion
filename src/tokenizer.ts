// src/tokenizer.ts

import { Token, Tokenizer, TokenType, Matcher } from "./types/tokenizer";

/* ---------- LANGUAGE DEFINITIONS ---------- */

// supported keywords (order doesn't matter)
export const keywords = [
  "print",
  "let",
  "if",
  "else",
  "end",
  "while",
  "break",
  "continue",
  "setpixel",
  "for",
  "in",
  "not",
  "fn",
  "return",
];


// supported operators (order matters: longer operators first)
export const operators = ["+", "-", "*", "/", "==", "!=", "<=", ">=", "<", ">", "&&", "||", ".."];

// identifiers: variable names
const identifierRegex = "^[a-zA-Z_][a-zA-Z0-9_]*";

/* ---------- HELPERS ---------- */

/**
 * Escape operators for regex ( +, *, etc are special chars )
 */
const escapeRegEx = (text: string) =>
  text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

/**
 * Returns a token if regex matches at the current index, with line/char tracking
 */
const regexMatcher =
  (regex: string, type: TokenType): Matcher =>
  (input: string, index: number, line: number, char: number) => {
    const match = input.substring(index).match(regex);
    return (
      match && {
        type,
        value: match[0],
        line,
        char,
      }
    );
  };

/* ---------- MATCHERS ---------- */
/* ORDER MATTERS (highest priority first) */

const matchers: Matcher[] = [
  regexMatcher("^[0-9]+(\\.[0-9]+)?", "number"),

  // Match keywords only as complete words (not prefix of identifier)
  regexMatcher(`^(${keywords.join("|")})(?![a-zA-Z0-9_])`, "keyword"),

  regexMatcher(identifierRegex, "identifier"),

  regexMatcher(`^(${operators.map(escapeRegEx).join("|")})`, "operator"),

  // grouping tokens: ( ) { } = ,
  regexMatcher("^[(){}=,]", "parens"),

  regexMatcher("^\\s+", "whitespace"),
];

/* ---------- TOKENIZER ---------- */

export const tokenize: Tokenizer = (input) => {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let char = 1;

  while (index < input.length) {
    const matches = matchers
      .map((m) => m(input, index, line, char))
      .filter(Boolean) as Token[];

    if (matches.length === 0) {
      throw new Error(
        `Unexpected token '${input[index]}' at line ${line}, column ${char}`
      );
    }

    const match = matches[0];

    if (match.type !== "whitespace") {
      tokens.push(match);
    }

    // Update line/char tracking
    for (const c of match.value) {
      if (c === '\n') {
        line++;
        char = 1;
      } else {
        char++;
      }
    }

    index += match.value.length;
  }

  return tokens;
};
