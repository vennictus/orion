// src/types/parser.ts

import { Token } from "./tokenizer";

export interface Parser {
  (tokens: Token[]): Program;
}

/* ---------- ROOT ---------- */

export type Program = StatementNode[];

/* ---------- STATEMENTS ---------- */

export type StatementNode = PrintStatementNode;

/* ---------- EXPRESSIONS ---------- */

export type ExpressionNode =
  | NumberLiteralNode
  | BinaryExpressionNode;

/* ---------- NODES ---------- */

export interface PrintStatementNode {
  type: "printStatement";
  expression: ExpressionNode;
}

export interface NumberLiteralNode {
  type: "numberLiteral";
  value: number;
}

export interface BinaryExpressionNode {
  type: "binaryExpression";
  left: ExpressionNode;
  right: ExpressionNode;
  operator: Operator;
}

/* ---------- OPERATORS ---------- */

export type Operator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "=="
  | "<"
  | ">"
  | "&&";
