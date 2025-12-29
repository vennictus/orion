// src/tokenizer.ts
import { Token, Tokenizer, TokenType, Matcher } from "./types/tokenizer";

export const keywords = ["print"];

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

// Matchers in precedence order
const matchers: Matcher[] = [
  regexMatcher(`^(${keywords.join("|")})`, "keyword"),
  regexMatcher("^[.0-9]+", "number"),
  regexMatcher("^\\s+", "whitespace"),
];

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
