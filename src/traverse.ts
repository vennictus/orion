// src/traverse.ts
import { ExpressionNode } from "./types/parser";

export type Visitor = (node: ExpressionNode) => void;

/**
 * Post-order traversal
 * left → right → node
 */
export default function traverse(
  node: ExpressionNode,
  visitor: Visitor
) {
  if (node.type === "binaryExpression") {
    traverse(node.left, visitor);
    traverse(node.right, visitor);
  }

  visitor(node);
}
