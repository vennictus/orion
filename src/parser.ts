// src/parser.ts
import { Parser, Program, StatementNode, ExpressionNode } from "./types/parser";
import { Token } from "./types/tokenizer";

export const parse: Parser = (tokens) => {
  let index = 0;
  let current = tokens[index];

  const eat = () => {
    index++;
    current = tokens[index];
  };

  const parseExpression = (): ExpressionNode => {
    if (!current) {
      throw new Error("Unexpected end of input");
    }

    if (current.type === "number") {
      const node: ExpressionNode = {
        type: "numberLiteral",
        value: Number(current.value),
      };
      eat();
      return node;
    }

    throw new Error(`Unexpected token in expression: ${current.type}`);
  };

  const parseStatement = (): StatementNode => {
    if (!current) {
      throw new Error("Unexpected end of input");
    }

    if (current.type === "keyword" && current.value === "print") {
      eat(); // consume 'print'
      return {
        type: "printStatement",
        expression: parseExpression(),
      };
    }

    throw new Error(`Unexpected token: ${current.value}`);
  };

  const program: Program = [];

  while (current) {
    program.push(parseStatement());
  }

  return program;
};
