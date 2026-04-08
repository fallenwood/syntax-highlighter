import * as vscode from 'vscode';
import * as parser from 'web-tree-sitter';

import { loadGrammarSource } from './GrammarSource';
import { getExtensionAssetPath } from './paths';
import { resolveScmCaptureTerm } from './ScmCapture';
import { getNodeType } from './common';

// Grammar class
const parserPromise = parser.Parser.init();

export class Grammar {
  // Parser
  parser: parser.Parser | undefined;
  query: parser.Query | undefined;

  readonly querySource: string;

  // Constructor
  constructor(private lang: string) {
    const grammarSource = loadGrammarSource(getExtensionAssetPath('grammars'), lang);
    this.querySource = grammarSource.source;
  }

  private getQueryCaptures(node: parser.Node) {
    if (!this.query) {
      return [];
    }

    return this.query.captures(node, {
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
    }).filter(capture => capture.node.id === node.id);
  }

  private resolveQueryTerm(node: parser.Node) {
    let term: string | undefined;

    for (const capture of this.getQueryCaptures(node)) {
      const mappedTerm = resolveScmCaptureTerm(capture.name);

      if (mappedTerm) {
        term = mappedTerm;
      }
    }

    return term;
  }

  private describeQueryCaptures(node: parser.Node) {
    const captures = this.getQueryCaptures(node);

    if (captures.length === 0) {
      return undefined;
    }

    return captures.map(capture => `@${capture.name}`).join(', ');
  }

  private parseWithQuery(tree: parser.Tree) {
    if (!this.query) {
      return [];
    }

    const termsByNode = new Map<string, { term: string; range: vscode.Range; startIndex: number }>();

    for (const capture of this.query.captures(tree.rootNode)) {
      const term = resolveScmCaptureTerm(capture.name);

      if (!term) {
        continue;
      }

      const node = capture.node;
      const key = `${node.id}:${node.startIndex}:${node.endIndex}`;

      termsByNode.set(key, {
        term,
        startIndex: node.startIndex,
        range: new vscode.Range(
          new vscode.Position(node.startPosition.row, node.startPosition.column),
          new vscode.Position(node.endPosition.row, node.endPosition.column)),
      });
    }

    return [...termsByNode.values()]
      .sort((left, right) => left.startIndex - right.startIndex)
      .map(({ term, range }) => ({ term, range }));
  }

  resolveTerm(node: parser.Node) {
    if (!this.query) {
      return undefined;
    }

    return this.resolveQueryTerm(node);
  }

  describeScope(node: parser.Node, depth = Number.MAX_SAFE_INTEGER) {
    const queryCaptures = this.describeQueryCaptures(node);
    if (queryCaptures) {
      return queryCaptures;
    }

    let scope = getNodeType(node);
    let parent = node.parent;

    for (let i = 0; i < depth && parent; i++) {
      scope = `${getNodeType(parent)} > ${scope}`;
      parent = parent.parent;
    }

    return scope;
  }

  // Parser initialization
  async init() {
    // Load wasm parser
    await parserPromise;
    this.parser = new parser.Parser();
    const langFile = getExtensionAssetPath('parsers', this.lang + '.wasm');
    const langObj = await parser.Language.load(langFile);
    this.parser.setLanguage(langObj);

    this.query = new parser.Query(langObj, this.querySource);
  }

  // Build syntax tree
  tree(doc: string) {
    return this.parser!.parse(doc)!;
  }

  // Parse syntax tree
  parse(tree: parser.Tree) {
    if (this.query) {
      return this.parseWithQuery(tree);
    }

    // Travel tree and peek terms
    const terms: { term: string; range: vscode.Range }[] = [];
    const stack: parser.Node[] = [];
    let node = tree.rootNode.firstChild as parser.Node | null | undefined;

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
            term,
            range: new vscode.Range(
              new vscode.Position(node.startPosition.row, node.startPosition.column),
              new vscode.Position(node.endPosition.row, node.endPosition.column)),
          });
        }

        // Go right
        node = node.nextSibling;
      }
    }

    return terms;
  }
}
