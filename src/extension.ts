import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { listGrammarLanguages } from './GrammarSource';
import { getExtensionAssetPath } from './paths';
import { TokensProvider } from "./TokensProvider";

// Semantic token legend
const termMap = new Map<string, { type: string, modifiers?: string[] }>();

function buildLegend() {
    // Terms vocabulary
    termMap.set("type", { type: "type" });
    termMap.set("scope", { type: "namespace" });
    termMap.set("function", { type: "function" });
    termMap.set("variable", { type: "variable" });
    termMap.set("number", { type: "number" });
    termMap.set("string", { type: "string" });
    termMap.set("comment", { type: "comment" });
    termMap.set("constant", { type: "variable", modifiers: ["readonly", "defaultLibrary"] });
    termMap.set("directive", { type: "macro" });
    termMap.set("control", { type: "keyword" });
    termMap.set("operator", { type: "operator" });
    termMap.set("modifier", { type: "type", modifiers: ["modification"] });
    termMap.set("punctuation", { type: "punctuation" });
    termMap.set("async", { type: "keyword", modifiers: [ "async" ] });
    termMap.set("parameter", { type : "parameter", modifiers: [ "declaration" ] });
    termMap.set("parameter_type", { type : "support", modifiers: [ "type" ] });

    // Tokens and modifiers in use
    const tokens: string[] = [];
    const modifiers: string[] = [];
    termMap.forEach(t => {
        if (!tokens.includes(t.type)) {
            tokens.push(t.type);
        }

        t.modifiers?.forEach(m => {
            if (!modifiers.includes(m)) {
                modifiers.push(m);
            }
        });
    });
    // Construct semantic token legend

    return new vscode.SemanticTokensLegend(tokens, modifiers);
}

const legend = buildLegend();

// Extension activation
export async function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration("syntax");
    const grammarDir = getExtensionAssetPath("grammars");
    const parsersDir = getExtensionAssetPath("parsers");

    // Languages
    const availableGrammars = listGrammarLanguages(grammarDir);

    const availableParsers: string[] = [];
    fs.readdirSync(parsersDir).forEach(name => {
        availableParsers.push(path.basename(name, ".wasm"));
    });

    const enabledLangs: string[] =
        config.get("highlightLanguages")!;
    const supportedLangs: { language: string }[] = [];
    availableGrammars.forEach(lang => {
        if (availableParsers.includes(lang) && enabledLangs.includes(lang)) {
            supportedLangs.push({ language: lang });
        }
    });

    const engine = new TokensProvider(legend, termMap);

    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            supportedLangs,
            engine,
            legend));

    // Register debug hover providers
    // Very useful tool for implementation and fixing of grammars
    if (config.get("debugHover")) {
        for (const lang of supportedLangs) {
            vscode.languages.registerHoverProvider(lang, engine);
        }
    }
}
