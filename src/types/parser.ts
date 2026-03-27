// src/types/parser.ts

import { Token } from "./tokenizer";

export interface Parser {
  (tokens: Token[]): Program;
}

/* ---------- ROOT ---------- */

export type TopLevelNode = StatementNode | FunctionDeclarationNode;
export type Program = TopLevelNode[];

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
  | ContinueStatementNode
  | SetPixelStatementNode
  | SetPixelRGBStatementNode
  | ReturnStatementNode;

/* ---------- EXPRESSIONS ---------- */

export type ExpressionNode =
  | NumberLiteralNode
  | BinaryExpressionNode
  | IdentifierNode
  | UnaryExpressionNode
  | CallExpressionNode;

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

export interface ReturnStatementNode extends ProgramNode {
  type: "returnStatement";
  value: ExpressionNode;
}

/* ---------- SETPIXEL STATEMENT ---------- */

export interface SetPixelStatementNode extends ProgramNode {
  type: "setpixelStatement";
  x: ExpressionNode;
  y: ExpressionNode;
  value: ExpressionNode;
}

export interface SetPixelRGBStatementNode extends ProgramNode {
  type: "setpixelrgbStatement";
  x: ExpressionNode;
  y: ExpressionNode;
  r: ExpressionNode;
  g: ExpressionNode;
  b: ExpressionNode;
}

/* ---------- FUNCTION DECLARATION ---------- */

export interface FunctionDeclarationNode extends ProgramNode {
  type: "functionDeclaration";
  name: string;
  params: string[];
  body: StatementNode[];
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

export interface UnaryExpressionNode extends ProgramNode {
  type: "unaryExpression";
  operator: "not" | "-";
  operand: ExpressionNode;
}

export interface CallExpressionNode extends ProgramNode {
  type: "callExpression";
  name: string;
  args: ExpressionNode[];
}

/* ---------- OPERATORS ---------- */

export type Operator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "=="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "&&"
  | "||";
