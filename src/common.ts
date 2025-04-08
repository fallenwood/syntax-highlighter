import * as parser from "web-tree-sitter";

export function getNodeType(node: parser.Node) {
  let type = node.type;

  if (!node.isNamed) {
    type = `"${type}"`;
  }

  return type;
}
