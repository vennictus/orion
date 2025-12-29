// src/types/parser.ts

import { Token } from "./tokenizer";

export interface Parser {
  (tokens: Token[]): Program;
}

// Root
export type Program = StatementNode[];

// Statements
export type StatementNode = PrintStatementNode;

// Expressions
export type ExpressionNode = NumberLiteralNode;

// Nodes
export interface PrintStatementNode {
  type: "printStatement";
  expression: ExpressionNode;
}

export interface NumberLiteralNode {
  type: "numberLiteral";
  value: number;
}
