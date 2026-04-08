import * as vscode from 'vscode';
import Parser = require('web-tree-sitter');
import * as jsonc from 'jsonc-parser';
import * as fs from 'fs';
import * as path from 'path';

import { ComplexScopeTrie, ComplexScopeVariant } from './ComplexScopeTrie';
import { getNodeType } from './common';

// Grammar class
const parserPromise = Parser.init();

export class Grammar {
  // Parser
  parser: Parser | undefined;

  // Grammar
  readonly simpleTerms: { [sym: string]: string } = {};
  readonly complexTerms: string[] = [];
  readonly complexScopes: { [sym: string]: string } = {};
  readonly complexScopeTrie: ComplexScopeTrie;
  readonly complexDepth: number;
  readonly complexOrder: boolean;

  // Constructor
  constructor(private lang: string) {
    // Parse grammar file
    const grammarFile = __dirname + "/../grammars/" + lang + ".json";
    const grammarJson = jsonc.parse(fs.readFileSync(grammarFile).toString());

    for (const t in grammarJson.simpleTerms) {
      this.simpleTerms[t] = grammarJson.simpleTerms[t];
    }

    for (const t in grammarJson.complexTerms) {
      this.complexTerms[t as never] = grammarJson.complexTerms[t];
    }

    for (const t in grammarJson.complexScopes) {
      this.complexScopes[t] = grammarJson.complexScopes[t];
    }

    this.complexScopeTrie = new ComplexScopeTrie(this.complexScopes);
    this.complexDepth = this.complexScopeTrie.depth;
    this.complexOrder = this.complexScopeTrie.ordered;
  }

  private getComplexScopeOrder(node: Parser.SyntaxNode) {
    let index = 0;
    let sibling = node.previousSibling;

    while (sibling) {
      if (sibling.type === node.type) {
        index++;
      }

      sibling = sibling.previousSibling;
    }

    let rindex = -1;
    sibling = node.nextSibling;

    while (sibling) {
      if (sibling.type === node.type) {
        rindex--;
      }

      sibling = sibling.nextSibling;
    }

    return { index, rindex };
  }

  private getComplexScopeVariants(node: Parser.SyntaxNode): ComplexScopeVariant[] {
    const type = getNodeType(node);

    if (!this.complexOrder) {
      return [{ scope: type, order: 0 }];
    }

    const { index, rindex } = this.getComplexScopeOrder(node);

    return [
      { scope: type, order: 0 },
      { scope: `${type}[${index}]`, order: 1 },
      { scope: `${type}[${rindex}]`, order: 2 },
    ];
  }

  private getAncestorTypes(node: Parser.SyntaxNode, maxDepth: number) {
    const ancestors: string[] = [];
    let parent = node.parent;

    for (let i = 0; i < maxDepth && parent; i++) {
      ancestors.push(getNodeType(parent));
      parent = parent.parent;
    }

    return ancestors;
  }

  private resolveComplexTerm(node: Parser.SyntaxNode, maxDepth: number) {
    return this.complexScopeTrie.resolve(
      this.getComplexScopeVariants(node),
      this.getAncestorTypes(node, maxDepth),
      maxDepth);
  }

  resolveTerm(node: Parser.SyntaxNode, maxDepth = this.complexDepth) {
    const type = getNodeType(node);

    if (!this.complexTerms.includes(type)) {
      return this.simpleTerms[type];
    }

    return this.resolveComplexTerm(node, maxDepth);
  }

  describeScope(node: Parser.SyntaxNode, depth = this.complexDepth) {
    let scope = getNodeType(node);
    let parent = node.parent;

    for (let i = 0; i < depth && parent; i++) {
      scope = `${getNodeType(parent)} > ${scope}`;
      parent = parent.parent;
    }

    if (!this.complexOrder) {
      return scope;
    }

    const { index, rindex } = this.getComplexScopeOrder(node);
    return `${scope}[${index}][${rindex}]`;
  }

  // Parser initialization
  async init() {
    // Load wasm parser
    await parserPromise;
    this.parser = new Parser();
    const langFile = path.join(__dirname, "../parsers", this.lang + ".wasm");
    const langObj = await Parser.Language.load(langFile);
    this.parser.setLanguage(langObj);
  }

  // Build syntax tree
  tree(doc: string) {
    return this.parser!.parse(doc);
  }

  // Parse syntax tree
  parse(tree: Parser.Tree) {
    // Travel tree and peek terms
    const terms: { term: string; range: vscode.Range }[] = [];
    const stack: Parser.SyntaxNode[] = [];
    let node = tree.rootNode.firstChild as Parser.SyntaxNode | null | undefined;

    while (stack.length > 0 || node) {
      // Go deeper
      if (node) {
        stack.push(node);
        node = node.firstChild;
      }
      // Go back
      else {
        node = stack.pop()!;

        const term = this.resolveTerm(node);

        // If term is found add it
        if (term) {
          terms.push({
            term: term,
            range: new vscode.Range(
              new vscode.Position(
                node.startPosition.row,
                node.startPosition.column),
              new vscode.Position(
                node.endPosition.row,
                node.endPosition.column)),
          });
        }
        // Go right
        node = node.nextSibling;
      }
    }

    return terms;
  }
}
