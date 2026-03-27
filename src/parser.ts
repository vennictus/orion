// src/parser.ts

import { Token } from "./types/tokenizer";
import {
  Parser,
  Program,
  StatementNode,
  ExpressionNode,
  PrintStatementNode,
  VariableDeclarationNode,
  AssignmentStatementNode,
  BlockStatementNode,
  IfStatementNode,
  WhileStatementNode,
  Operator,
  BreakStatementNode,
  ContinueStatementNode,
  SetPixelStatementNode,
  UnaryExpressionNode,
  CallExpressionNode,
  FunctionDeclarationNode,
  ReturnStatementNode,
  TopLevelNode,
} from "./types/parser";

export class ParserError extends Error {
  constructor(message: string, public token?: Token) {
    const loc = token ? ` at line ${token.line}, column ${token.char}` : "";
    super(message + loc);
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

    // -------- UNARY NEGATION: -expr --------
    if (current.type === "operator" && current.value === "-") {
      eat("-");
      const operand = parseExpression();
      return {
        type: "unaryExpression",
        operator: "-",
        operand,
      } as UnaryExpressionNode;
    }

    // -------- NOT OPERATOR: not expr --------
    if (current.type === "keyword" && current.value === "not") {
      eat("not");
      const operand = parseExpression();
      return {
        type: "unaryExpression",
        operator: "not",
        operand,
      } as UnaryExpressionNode;
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

    // -------- IDENTIFIER OR FUNCTION CALL --------
    if (current.type === "identifier") {
      const name = current.value;
      const identToken = current;
      eat();
      
      // Check if this is a function call: identifier immediately followed by (
      // Use char position to detect adjacency (no whitespace between)
      const nextToken = current as Token | undefined;
      if (nextToken && nextToken.type === "parens" && nextToken.value === "(") {
        // Only treat as call if ( is adjacent to identifier (no whitespace)
        if (nextToken.char === identToken.char + identToken.value.length) {
          eat("(");
          const args: ExpressionNode[] = [];
          
          // Parse comma-separated arguments
          let tok = current as Token | undefined;
          while (tok && !(tok.type === "parens" && tok.value === ")")) {
            args.push(parseExpression());
            tok = current as Token | undefined;
            // Skip comma if present
            if (tok && tok.type === "parens" && tok.value === ",") {
              eat(",");
              tok = current as Token | undefined;
            }
          }
          
          const closeToken = current as Token | undefined;
          if (!closeToken || closeToken.value !== ")") {
            throw new ParserError("Expected ')' after function arguments", closeToken);
          }
          eat(")");
          
          return {
            type: "callExpression",
            name,
            args,
          } as CallExpressionNode;
        }
      }
      
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
      !(current.type === "keyword" && terminators.includes(current.value as string))
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

  const parseReturnStatement = (): ReturnStatementNode => {
    eat("return");
    const value = parseExpression();
    return {
      type: "returnStatement",
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

  /* ---------- IF STATEMENT ---------- */

  const parseIfStatement = (): IfStatementNode => {
    eat("if");

    eat("(");

    const left = parseExpression();
    let condition: ExpressionNode = left;

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

    if (!current || current.value !== ")") {
      throw new ParserError("Expected ')'", current);
    }

    eat(")");

    const thenBlock = parseStatementList(["else", "end"]);

    let elseBlock: StatementNode[] | undefined;

    if (current && (current.value as string) === "else") {
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

  /* ---------- WHILE STATEMENT ---------- */

  const parseWhileStatement = (): WhileStatementNode => {
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

  /* ---------- FOR LOOP (DESUGARS TO WHILE) ---------- */

  const parseForStatement = (): BlockStatementNode => {
    eat("for");

    const loopVarToken = current as Token | undefined;
    if (!loopVarToken || loopVarToken.type !== "identifier") {
      throw new ParserError("Expected loop variable name", loopVarToken);
    }
    const loopVar = loopVarToken.value;
    eat();

    const inToken = current as Token | undefined;
    if (!inToken || inToken.value !== "in") {
      throw new ParserError("Expected 'in'", inToken);
    }
    eat("in");

    const startExpr = parseExpression();

    const dotDotToken = current as Token | undefined;
    if (!dotDotToken || dotDotToken.value !== "..") {
      throw new ParserError("Expected '..'", dotDotToken);
    }
    eat("..");

    const endExpr = parseExpression();

    const body = parseStatementList(["end"]);
    eat("end");

    // Desugar: for i in start..end → let i = start; while (i < end) body; i = (i + 1) end
    return {
      type: "blockStatement",
      body: [
        {
          type: "variableDeclaration",
          name: loopVar,
          initializer: startExpr,
        },
        {
          type: "whileStatement",
          condition: {
            type: "binaryExpression",
            left: { type: "identifier", name: loopVar },
            right: endExpr,
            operator: "<",
          },
          body: [
            ...body,
            {
              type: "assignmentStatement",
              name: loopVar,
              value: {
                type: "binaryExpression",
                left: { type: "identifier", name: loopVar },
                right: { type: "numberLiteral", value: 1 },
                operator: "+",
              },
            },
          ],
        },
      ],
    } as BlockStatementNode;
  };

  /* ---------- SETPIXEL STATEMENT ---------- */

  const parseSetPixelStatement = (): SetPixelStatementNode => {
    eat("setpixel");

    const x = parseExpression();
    const y = parseExpression();
    const value = parseExpression();

    return {
      type: "setpixelStatement",
      x,
      y,
      value,
    };
  };

  /* ---------- FUNCTION DECLARATION ---------- */

  const parseFunctionDeclaration = (): FunctionDeclarationNode => {
    eat("fn");

    const nameToken = current as Token | undefined;
    if (!nameToken || nameToken.type !== "identifier") {
      throw new ParserError("Expected function name", nameToken);
    }
    const name = nameToken.value;
    eat();

    const openParen = current as Token | undefined;
    if (!openParen || openParen.value !== "(") {
      throw new ParserError("Expected '(' after function name", openParen);
    }
    eat("(");

    const params: string[] = [];
    let paramToken = current as Token | undefined;
    while (paramToken && paramToken.type === "identifier") {
      params.push(paramToken.value);
      eat();
      paramToken = current as Token | undefined;
      // Skip comma if present
      if (paramToken && paramToken.type === "parens" && paramToken.value === ",") {
        eat(",");
        paramToken = current as Token | undefined;
      }
    }

    const closeParen = current as Token | undefined;
    if (!closeParen || closeParen.value !== ")") {
      throw new ParserError("Expected ')' after parameters", closeParen);
    }
    eat(")");

    const body = parseStatementList(["end"]);
    eat("end");

    return {
      type: "functionDeclaration",
      name,
      params,
      body,
    };
  };

  /* ---------- STATEMENT DISPATCH ---------- */

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
        case "for":
          return parseForStatement();
        case "break":
          return parseBreakStatement();
        case "continue":
          return parseContinueStatement();
        case "return":
          return parseReturnStatement();
        case "setpixel":
          return parseSetPixelStatement();
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
    if (current.type === "keyword" && current.value === "fn") {
      program.push(parseFunctionDeclaration());
    } else {
      program.push(parseStatement());
    }
  }

  return program;
};
