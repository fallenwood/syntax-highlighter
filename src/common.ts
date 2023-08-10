import * as parser from "web-tree-sitter";

export function getNodeType(node: parser.SyntaxNode) {
  let type = node.type;

  if (!node.isNamed()) {
    type = `"${type}"`;
  }

  return type;
}
