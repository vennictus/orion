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
  VariableDeclarationNode,
  AssignmentStatementNode,
  BlockStatementNode,
  IdentifierNode,
  Operator,
} from "./types/parser";

export class ParserError extends Error {
  constructor(message: string, public token?: Token) {
    super(message);
  }
}

export const parse: Parser = (tokens) => {
  const iterator = tokens[Symbol.iterator]();
  let current = iterator.next().value as Token | undefined;

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

  /* ---------- EXPRESSIONS ---------- */
const parseExpression = (): ExpressionNode => {
  if (!current) {
    throw new ParserError("Unexpected end of input");
  }

  // -------- NUMBER --------
  if (current.type === "number") {
    const value = Number(current.value);
    eat();
    return {
      type: "numberLiteral",
      value,
    };
  }

  // -------- IDENTIFIER --------
  if (current.type === "identifier") {
    const name = current.value;
    eat();
    return {
      type: "identifier",
      name,
    };
  }

  // -------- GROUPED EXPRESSION --------
  if (current.type === "parens" && current.value === "(") {
    eat("(");

    const left = parseExpression();

    // 🔑 SNAPSHOT operator token
    const operatorToken = current;
    if (!operatorToken || operatorToken.type !== "operator") {
      throw new ParserError("Expected operator", operatorToken);
    }

    const operator = operatorToken.value as Operator;
    eat(); // consume operator

    const right = parseExpression();

    // 🔑 SNAPSHOT closing paren
    const closing = current;
    if (!closing || closing.type !== "parens" || closing.value !== ")") {
      throw new ParserError("Expected ')'", closing);
    }

    eat(")");

    return {
      type: "binaryExpression",
      left,
      right,
      operator,
    };
  }

  throw new ParserError(
    `Unexpected token '${current.value}'`,
    current
  );
};


  /* ---------- STATEMENTS ---------- */

  const parsePrintStatement = (): PrintStatementNode => {
    eat("print");
    const expression = parseExpression();
    return {
      type: "printStatement",
      expression,
    };
  };

  const parseVariableDeclaration = (): VariableDeclarationNode => {
    eat("let");

    if (!current || current.type !== "identifier") {
      throw new ParserError("Expected variable name", current);
    }

    const name = current.value;
    eat();

    if (!current || current.value !== "=") {
      throw new ParserError("Expected '='", current);
    }

    eat("=");

    const initializer = parseExpression();

    return {
      type: "variableDeclaration",
      name,
      initializer,
    };
  };

  const parseAssignmentStatement = (): AssignmentStatementNode => {
    if (!current || current.type !== "identifier") {
      throw new ParserError("Expected identifier", current);
    }

    const name = current.value;
    eat();

    if (!current || current.value !== "=") {
      throw new ParserError("Expected '='", current);
    }

    eat("=");

    const value = parseExpression();

    return {
      type: "assignmentStatement",
      name,
      value,
    };
  };

  const parseBlockStatement = (): BlockStatementNode => {
    eat("{");

    const body: StatementNode[] = [];

    while (current && current.value !== "}") {
      body.push(parseStatement());
    }

    if (!current) {
      throw new ParserError("Expected '}'");
    }

    eat("}");

    return {
      type: "blockStatement",
      body,
    };
  };

  const parseStatement = (): StatementNode => {
    if (!current) {
      throw new ParserError("Unexpected end of input");
    }

    // block
    if (current.type === "parens" && current.value === "{") {
      return parseBlockStatement();
    }

    // keyword-based
    if (current.type === "keyword") {
      switch (current.value) {
        case "print":
          return parsePrintStatement();
        case "let":
          return parseVariableDeclaration();
      }
    }

    // assignment
    if (current.type === "identifier") {
      return parseAssignmentStatement();
    }

    throw new ParserError(
      `Unexpected token '${current.value}'`,
      current
    );
  };

  /* ---------- PROGRAM ---------- */

  const program: Program = [];

  while (current) {
    program.push(parseStatement());
  }

  return program;
};
