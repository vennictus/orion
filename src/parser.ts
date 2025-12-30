// src/parser.ts

import { Token } from "./types/tokenizer";
import {
  Parser,
  Program,
  StatementNode,
  ExpressionNode,
  PrintStatementNode,
  NumberLiteralNode,
  BinaryExpressionNode,
  Operator,
  VariableDeclarationNode,
  IdentifierNode,
} from "./types/parser";

export class ParserError extends Error {
  constructor(message: string, public token: Token) {
    super(message);
  }
}

export const parse: Parser = (tokens) => {
  const iterator = tokens[Symbol.iterator]();
  let current = iterator.next().value as Token | undefined;

  /* ---------- TOKEN CONSUMPTION ---------- */

  const eat = (expectedValue?: string) => {
    if (!current) return;

    if (expectedValue && current.value !== expectedValue) {
      throw new ParserError(
        `Expected '${expectedValue}', got '${current.value}'`,
        current
      );
    }

    current = iterator.next().value;
  };

  const expectIdentifier = (): string => {
    if (!current || current.type !== "identifier") {
      throw new ParserError(
        `Expected identifier, got ${current?.type}`,
        current!
      );
    }

    const name = current.value;
    eat();
    return name;
  };

  /* ---------- EXPRESSIONS ---------- */

  const parseExpression = (): ExpressionNode => {
    if (!current) {
      throw new ParserError(
        "Unexpected end of input",
        tokens[tokens.length - 1]
      );
    }

    switch (current.type) {
      case "number": {
        const node: NumberLiteralNode = {
          type: "numberLiteral",
          value: Number(current.value),
        };
        eat();
        return node;
      }

      case "identifier": {
        const node: IdentifierNode = {
          type: "identifier",
          name: current.value,
        };
        eat();
        return node;
      }

      case "parens": {
        eat("("); // (

        const left = parseExpression();

        if (!current) {
          throw new ParserError("Expected operator", current!);
        }

        const operator = current.value as Operator;
        eat();

        const right = parseExpression();
        eat(")"); // )

        const node: BinaryExpressionNode = {
          type: "binaryExpression",
          operator,
          left,
          right,
        };

        return node;
      }

      default:
        throw new ParserError(
          `Unexpected token type ${current.type}`,
          current
        );
    }
  };

  /* ---------- STATEMENTS ---------- */

  const parseVariableDeclaration = (): VariableDeclarationNode => {
    eat("let");

    const name = expectIdentifier();

    eat("=");

    const initializer = parseExpression();

    return {
      type: "variableDeclaration",
      name,
      initializer,
    };
  };

  const parseStatement = (): StatementNode => {
    if (!current || current.type !== "keyword") {
      throw new ParserError("Statement must start with keyword", current!);
    }

    switch (current.value) {
      case "print": {
        eat("print");

        const expression = parseExpression();

        const stmt: PrintStatementNode = {
          type: "printStatement",
          expression,
        };

        return stmt;
      }

      case "let": {
        return parseVariableDeclaration();
      }

      default:
        throw new ParserError(
          `Unknown keyword ${current.value}`,
          current
        );
    }
  };

  /* ---------- PROGRAM ---------- */

  const program: Program = [];

  while (current) {
    program.push(parseStatement());
  }

  return program;
};
