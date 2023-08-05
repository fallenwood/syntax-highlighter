import * as vscode from 'vscode';
import * as parser from 'web-tree-sitter';
import * as jsonc from 'jsonc-parser';
import * as fs from 'fs';
import * as path from 'path';

import { getNodeType } from './common';

// Grammar class
const parserPromise = parser.init();

export class Grammar {
  // Parser
  parser: parser | any;

  // Grammar
  readonly simpleTerms: { [sym: string]: string } = {};
  readonly complexTerms: string[] = [];
  readonly complexScopes: { [sym: string]: string } = {};
  readonly complexDepth: number = 0;
  readonly complexOrder: boolean = false;

  // Constructor
  constructor(private lang: string) {
    // Parse grammar file
    const grammarFile = __dirname + "/../grammars/" + lang + ".json";
    const grammarJson = jsonc.parse(fs.readFileSync(grammarFile).toString());

    for (const t in grammarJson.simpleTerms) {
      this.simpleTerms[t] = grammarJson.simpleTerms[t];
    }

    for (const t in grammarJson.complexTerms) {
      this.complexTerms[t as any] = grammarJson.complexTerms[t];
    }

    for (const t in grammarJson.complexScopes) {
      this.complexScopes[t] = grammarJson.complexScopes[t];
    }

    for (const s in this.complexScopes) {
      const depth = s.split(">").length;

      if (depth > this.complexDepth) {
        this.complexDepth = depth;
      }

      if (s.indexOf("[") >= 0) {
        this.complexOrder = true;
      }
    }

    this.complexDepth--;
  }

  // Parser initialization
  async init() {
    // Load wasm parser
    await parserPromise;
    this.parser = new parser();
    let langFile = path.join(__dirname, "../parsers", this.lang + ".wasm");
    const langObj = await parser.Language.load(langFile);
    this.parser.setLanguage(langObj);
  }

  // Build syntax tree
  tree(doc: string) {
    return this.parser.parse(doc);
  }

  // Parse syntax tree
  parse(tree: parser.Tree) {
    // Travel tree and peek terms
    let terms: { term: string; range: vscode.Range }[] = [];
    let stack: parser.SyntaxNode[] = [];
    let node = tree.rootNode.firstChild as parser.SyntaxNode | null | undefined;

    while (stack.length > 0 || node) {
      // Go deeper
      if (node) {
        stack.push(node);
        node = node.firstChild;
      }
      // Go back
      else {
        node = stack.pop()!;

        let type = getNodeType(node);

        // Simple one-level terms
        let term: string | undefined = undefined;
        if (!this.complexTerms.includes(type)) {
          term = this.simpleTerms[type];
        }
        // Complex terms require multi-level analyzes
        else {
          // Build complex scopes
          let desc = type;
          let scopes = [desc];
          let parent = node.parent;
          for (let i = 0; i < this.complexDepth && parent; i++) {
            const parentType = getNodeType(parent);

            desc = `${parentType} > ${desc}`;
            scopes.push(desc);
            parent = parent.parent;
          }

          // If there is also order complexity
          if (this.complexOrder) {
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
              if (sibling.type === node.type)
                rindex--;
              sibling = sibling.nextSibling;
            }

            let orderScopes: string[] = [];

            for (let i = 0; i < scopes.length; i++) {
              orderScopes.push(
                scopes[i],
                `${scopes[i]}[${index}]`,
                `${scopes[i]}[${rindex}]`);
            }

            scopes = orderScopes;
          }

          // Use most complex scope
          for (const d of scopes) {
            if (d in this.complexScopes) {
              term = this.complexScopes[d];
            }
          }
        }

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
