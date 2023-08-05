Contributing
===

## Basics

1. Have *VSCode >= 1.80* and *Nodejs* installed. I don't know the minimal Nodejs version required, but it works for me on *v18.12.1*

2. Have *C/C++* compiler installed, I have *G++ 12.2.0* and *Clang 14.0.6* installed on a Fedora Linux
    - I haven't successfuled built this project on windows yet

3. Run `npm i`, `yarn install` or `pnpm i` depends on your tastes

4. Open the repo with *VSCode*, press *F5* to start debugging
    - You can uncomment `// "--profile-temp",` inside `.vscode/launch.json` to debug in a clean environment

5. Open the code you want to render in the debugging VSCode window, the extension should work

## Advanced

### DebugHover

DebugHover can be enabled when debugging, there are 2 ways

1. Change the settings `syntax.debugHover.default` to `true` in `package.json`
2. Open a folder with debug vscode, add the following configuration to `.vscode/settings.json`
    ```json
    {
      "syntax": {
          "debugHover": "true"
      }
    }
    ```

### Gramma Explanation

There are `grammars/<grammar>.json` defined in this project, there are 2 main usage of the json files

#### Build tree sitter wasm plugins

When installing packages, nodejs should have built the wasm plugins for you under parsers folder, you can also run `pnpm run postinstall` to rebuild them.

The build script is `script/build.js`, it will load the json filename, remap to tree sitter plugin, call tree sitter binary to build and move the built files to parsers.

The remapping looks like
```json
{
    csharp: {
        module: ["c-sharp"],
        output: "c_sharp",
    },
}
```

which means, the json file is `csharp.json`, the tree sitter module name is `tree-sitter-c-sharp`, the wasm filename is `tree-sitter-c_sharp.wasm`, and finally renamed to `csharp.wasm`

It's a bit confusing, but it worked for me to add a new language support for C# :)

#### Render the highlight at runtime

When the extension starts for a supported language, it will load the wasm to parse the document and gets the AST.The json file works like a brige between AST and VSCode.

For example, to make a C# foreach statement work, the AST structure looks like
```json
"complexTerms": [
  "identifier",
],
"complexScopes": {
  "for_each_statement > identifier[-2] ": "parameter",
}
```
The `complexTerms` tells the extension, when current token type is `identifier`, it could be the ending of a complex scope, so the extension will DFS the AST to find a longest scope that ends with `identifier` and exists in predefined `complexScopes`

The example complex scopes mean, the identifier is the second last of under a for each statement, take a real world example here

```C#
foreach (var x in digits)
```

There are 4 tokens inside the brackets, the AST paths are

```
var:    block > for_each_statement > implicit_type > "var"
x:      block > for_each_statement > identifier[0][-2]
in:     block > for_each_statement > "in"
digist: block > for_each_statement > identifier[1][-1]
```

So `x` is both the 0th and -2nd identifier inside `for_each_statement`, and we define this as `parameter`.

`parameter` is a extension-defined concept, in `extension.ts`, it's mapped to VSCode like

```typescript
    termMap.set("parameter", { type : "parameter", modifiers: [ "declaration" ] });
```

Where type and modifiers are defined by [VSCode](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#scope-inspector ""), and how it looks like depends on your theme.

I have verified it works in Monokai theme with *italic* style.

The `parameter` type also needs to be enabled in both `packages.json` and `TokensProvider.ts`

### How to contribute

I forked this repo from [original](https://github.com/EvgeniyPeshkov/syntax-highlighter "") under the same MIT license, and it's open for any issues (no promise to resolve :) ) or PRs
