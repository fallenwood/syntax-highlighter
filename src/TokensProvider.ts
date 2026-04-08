import * as vscode from 'vscode';
import Parser = require('web-tree-sitter');

import { Grammar } from './Grammar';

// Semantic token provider
export class TokensProvider implements vscode.DocumentSemanticTokensProvider, vscode.HoverProvider {
  readonly grammars: { [lang: string]: Grammar } = {};
  readonly trees: { [doc: string]: Parser.Tree } = {};
  readonly supportedTerms: string[] = [];
  readonly debugDepth: number;

  constructor(
    private legend: vscode.SemanticTokensLegend,
    private termMap: Map<string, { type: string, modifiers?: string[] }>) {
    // Terms
    const availableTerms: string[] = [
      "type", "scope", "function", "variable", "number", "string", "comment",
      "constant", "directive", "control", "operator", "modifier", "punctuation",
      "async", "parameter",
    ];
    const enabledTerms: string[] = vscode.workspace.
      getConfiguration("syntax").get("highlightTerms")!;
    availableTerms.forEach(term => {
      if (enabledTerms.includes(term))
        this.supportedTerms.push(term);
    });

    if (!vscode.workspace.getConfiguration("syntax").get("highlightComment")) {
      if (this.supportedTerms.includes("comment")) {
        this.supportedTerms.splice(this.supportedTerms.indexOf("comment"), 1);
      }
    }

    this.debugDepth = vscode.workspace.getConfiguration("syntax").get("debugDepth")!;
  }

  // Provide document tokens
  async provideDocumentSemanticTokens(
    doc: vscode.TextDocument,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
    // Grammar
    const lang = doc.languageId;

    if (!(lang in this.grammars)) {
      this.grammars[lang] = new Grammar(lang);
      await this.grammars[lang].init();
    }

    // Parse document
    const grammar = this.grammars[lang];
    const tree = grammar.tree(doc.getText());
    const terms = grammar.parse(tree);
    this.trees[doc.uri.toString()] = tree;

    // Build tokens
    const builder = new vscode.SemanticTokensBuilder(this.legend);
    terms.forEach((t) => {
      if (!this.supportedTerms.includes(t.term)) {
        return;
      }

      const type = this.termMap.get(t.term)!.type;
      const modifiers = this.termMap.get(t.term)!.modifiers;

      if (t.range.start.line === t.range.end.line) {
        return builder.push(t.range, type, modifiers);
      }

      let line = t.range.start.line;
      builder.push(
        new vscode.Range(
          t.range.start,
          doc.lineAt(line).range.end
        ),
        type,
        modifiers);

      for (line = line + 1; line < t.range.end.line; line++) {
        builder.push(
          doc.lineAt(line).range,
          type,
          modifiers);
      }

      builder.push(
        new vscode.Range(
          doc.lineAt(line).range.start,
          t.range.end),
        type,
        modifiers);
    });

    return builder.build();
  }

  // Provide hover tooltips
  async provideHover(
    doc: vscode.TextDocument,
    pos: vscode.Position,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: vscode.CancellationToken): Promise<vscode.Hover | null> {
    const uri = doc.uri.toString();
    if (!(uri in this.trees))
      return null;
    const grammar = this.grammars[doc.languageId];
    const tree = this.trees[uri];

    const xy: Parser.Point = { row: pos.line, column: pos.character };

    const node = tree.rootNode.descendantForPosition(xy);

    if (!node) {
      return null;
    }

    const depth = Math.max(grammar.complexDepth, this.debugDepth);
    const term = grammar.resolveTerm(node, depth);
    const scope = grammar.describeScope(node, depth);

    return {
      contents: [scope, `Term: ${term || ""}`],
      range: new vscode.Range(
        node.startPosition.row, node.startPosition.column,
        node.endPosition.row, node.endPosition.column)
    };
  }
}
