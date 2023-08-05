import * as vscode from 'vscode';
import * as parser from 'web-tree-sitter';

import { Grammar } from './Grammar';

// Semantic token provider
export class TokensProvider implements vscode.DocumentSemanticTokensProvider, vscode.HoverProvider {
    readonly grammars: { [lang: string]: Grammar } = {};
    readonly trees: { [doc: string]: parser.Tree } = {};
    readonly supportedTerms: string[] = [];
    readonly debugDepth: number;

    constructor(
        private legend: vscode.SemanticTokensLegend,
        private termMap: Map<string, { type: string, modifiers?: string[] }>) {
        // Terms
        const availableTerms: string[] = [
            "type", "scope", "function", "variable", "number", "string", "comment",
            "constant", "directive", "control", "operator", "modifier", "punctuation",
        ];
        const enabledTerms: string[] = vscode.workspace.
            getConfiguration("syntax").get("highlightTerms")!;
        availableTerms.forEach(term => {
            if (enabledTerms.includes(term))
                this.supportedTerms.push(term);
        });
        if (!vscode.workspace.getConfiguration("syntax").get("highlightComment"))
            if (this.supportedTerms.includes("comment"))
                this.supportedTerms.splice(this.supportedTerms.indexOf("comment"), 1);
        this.debugDepth = vscode.workspace.getConfiguration("syntax").get("debugDepth")!;
    }

    // Provide document tokens
    async provideDocumentSemanticTokens(
        doc: vscode.TextDocument,
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
            builder.push(new vscode.Range(t.range.start,
                doc.lineAt(line).range.end), type, modifiers);

            for (line = line + 1; line < t.range.end.line; line++) {
                builder.push(doc.lineAt(line).range, type, modifiers);
            }

            builder.push(new vscode.Range(doc.lineAt(line).range.start,
                t.range.end), type, modifiers);
        });

        return builder.build();
    }

    // Provide hover tooltips
    async provideHover(
        doc: vscode.TextDocument,
        pos: vscode.Position,
        token: vscode.CancellationToken): Promise<vscode.Hover | null> {
        const uri = doc.uri.toString();
        if (!(uri in this.trees))
            return null;
        const grammar = this.grammars[doc.languageId];
        const tree = this.trees[uri];

        const xy: parser.Point = { row: pos.line, column: pos.character };
        let node = tree.rootNode.descendantForPosition(xy);
        if (!node)
            return null;

        let type = node.type;
        if (!node.isNamed())
            type = '"' + type + '"';
        let parent = node.parent;

        const depth = Math.max(grammar.complexDepth, this.debugDepth);
        for (let i = 0; i < depth && parent; i++) {
            let parentType = parent.type;
            if (!parent.isNamed())
                parentType = '"' + parentType + '"';
            type = parentType + " > " + type;
            parent = parent.parent;
        }

        // If there is also order complexity
        if (grammar.complexOrder) {
            let index = 0;
            let sibling = node.previousSibling;
            while (sibling) {
                if (sibling.type === node.type)
                    index++;
                sibling = sibling.previousSibling;
            }

            let rindex = -1;
            sibling = node.nextSibling;
            while (sibling) {
                if (sibling.type === node.type)
                    rindex--;
                sibling = sibling.nextSibling;
            }

            type = type + "[" + index + "]" + "[" + rindex + "]";
        }

        return {
            contents: [type],
            range: new vscode.Range(
                node.startPosition.row, node.startPosition.column,
                node.endPosition.row, node.endPosition.column)
        };
    }
}
