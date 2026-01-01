// src/types/parser.ts

import { Token } from "./tokenizer";

export interface Parser {
  (tokens: Token[]): Program;
}

/* ---------- ROOT ---------- */

export type Program = StatementNode[];

/* ---------- BASE NODE ---------- */

export interface ProgramNode {
  type: string;
}

/* ---------- STATEMENTS ---------- */

export type StatementNode =
  | PrintStatementNode
  | VariableDeclarationNode
  | AssignmentStatementNode
  | BlockStatementNode
  | IfStatementNode
  | WhileStatementNode
  | BreakStatementNode
  | ContinueStatementNode;

/* ---------- EXPRESSIONS ---------- */

export type ExpressionNode =
  | NumberLiteralNode
  | BinaryExpressionNode
  | IdentifierNode;

/* ---------- STATEMENT NODES ---------- */

export interface PrintStatementNode extends ProgramNode {
  type: "printStatement";
  expression: ExpressionNode;
}

export interface VariableDeclarationNode extends ProgramNode {
  type: "variableDeclaration";
  name: string;
  initializer: ExpressionNode;
}

export interface AssignmentStatementNode extends ProgramNode {
  type: "assignmentStatement";
  name: string;
  value: ExpressionNode;
}

export interface BlockStatementNode extends ProgramNode {
  type: "blockStatement";
  body: StatementNode[];
}

export interface IfStatementNode extends ProgramNode {
  type: "ifStatement";
  condition: ExpressionNode;
  thenBlock: StatementNode[];
  elseBlock?: StatementNode[];
}

export interface WhileStatementNode extends ProgramNode {
  type: "whileStatement";
  condition: ExpressionNode;
  body: StatementNode[];
}

export interface BreakStatementNode extends ProgramNode {
  type: "breakStatement";
}

export interface ContinueStatementNode extends ProgramNode {
  type: "continueStatement";
}

/* ---------- EXPRESSION NODES ---------- */

export interface IdentifierNode extends ProgramNode {
  type: "identifier";
  name: string;
}

export interface NumberLiteralNode extends ProgramNode {
  type: "numberLiteral";
  value: number;
}

export interface BinaryExpressionNode extends ProgramNode {
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
