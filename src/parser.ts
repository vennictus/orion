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
  BreakStatementNode,
  ContinueStatementNode,
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

      const operatorToken = current;
      if (!operatorToken || operatorToken.type !== "operator") {
        throw new ParserError("Expected operator", operatorToken);
      }

      const operator = operatorToken.value as Operator;
      eat();

      const right = parseExpression();

      const closing = current;
      if (!closing || !(closing.type === "parens" && closing.value === ")")) {
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

  /* ---------- STATEMENT LIST (BLOCK HELPER) ---------- */

  const parseStatementList = (terminators: string[]): StatementNode[] => {
    const body: StatementNode[] = [];

    while (
      current &&
      !(current.type === "keyword" && terminators.includes(current.value))
    ) {
      body.push(parseStatement());
    }

    return body;
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

  const parseBreakStatement = (): BreakStatementNode => {
  eat("break");

  return {
    type: "breakStatement",
  };
};

const parseContinueStatement = (): ContinueStatementNode => {
  eat("continue");

  return {
    type: "continueStatement",
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

  /* ---------- IF STATEMENT (MOVED, NOT DELETED) ---------- */
const parseIfStatement = (): any => {
  eat("if");

  eat("(");

  const left = parseExpression();

  let condition: ExpressionNode = left;

  // optional binary condition
  const opToken = current;
  if (opToken && opToken.type === "operator") {
    const operator = opToken.value as Operator;
    eat();

    const right = parseExpression();

    condition = {
      type: "binaryExpression",
      left,
      right,
      operator,
    };
  }

  // ---- CLOSE PAREN ----
  const closeParen = current;
  if (!closeParen || closeParen.value !== ")") {
    throw new ParserError("Expected ')'", closeParen);
  }

  eat(")");

  // ---- THEN BLOCK ----
  const thenBlock = parseStatementList(["else", "end"]);

  let elseBlock: StatementNode[] | undefined;

  // ---- ELSE BLOCK ----
  const next = current;
  if (next && next.value === "else") {
    eat("else");
    elseBlock = parseStatementList(["end"]);
  }

  eat("end");

  return {
    type: "ifStatement",
    condition,
    thenBlock,
    elseBlock,
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
    case "if":
      return parseIfStatement();
    case "while":
      return parseWhileStatement();
    case "break":
      return parseBreakStatement();
    case "continue":
      return parseContinueStatement();
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



const parseWhileStatement = (): any => {
  eat("while");

eat("(");

const left = parseExpression();
let condition: ExpressionNode = left;

if (current && current.type === "operator") {
  const operator = current.value as Operator;
  eat();
  const right = parseExpression();

  condition = {
    type: "binaryExpression",
    left,
    right,
    operator,
  };
}

if (!current || current.value !== ")") {
  throw new ParserError("Expected ')'", current);
}

eat(")");


  const body = parseStatementList(["end"]);

  eat("end");

  return {
    type: "whileStatement",
    condition,
    body,
  };
};


  /* ---------- PROGRAM ---------- */

  const program: Program = [];

  while (current) {
    program.push(parseStatement());
  }

  return program;
};
