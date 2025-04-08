#!/usr/bin/env node

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require("os");

// Languages
let langs: string[] = [];
fs.readdirSync(__dirname + "/../grammars/").forEach((name: string) => {
  langs.push(path.basename(name, ".json"));
});

// Language-package map
const langMap = {
  csharp: {
    module: ["c-sharp"],
    prebuilt: "tree-sitter-c_sharp.wasm",
    output: "c_sharp",
  },
  d: {
    generate: true,
  },
  shellscript: {
    module: ["bash"],
    prebuilt: "tree-sitter-bash.wasm",
    output: "bash",
  },
  typescriptreact: {
    module: ["typescript"],
    prebuilt: "tree-sitter-tsx.wasm",
    output: "c_sharp",
  },
} as any;

// Build wasm parsers for supported languages
const parsersDir = path.resolve(path.join(__dirname, "..", "parsers"));
if (!fs.existsSync(parsersDir)) {
  fs.mkdirSync(parsersDir);
}
for (const lang of langs) {
  let module = path.resolve(path.join(__dirname, "..", "node_modules", `tree-sitter-${lang}`));
  let output = "tree-sitter-" + lang + ".wasm";
  let prebuilt = output;

  const mapping = langMap[lang];

  if (mapping) {
    if (mapping.module) {
      module = path.join(
        __dirname,
        "..",
        "node_modules",
        "tree-sitter-" + mapping.module[0],
        ...mapping.module.slice(1),
      );
    }

    if (mapping.output) {
      output = "tree-sitter-" + mapping.output + ".wasm";
    }

    if (mapping.prebuilt) {
      prebuilt = mapping.prebuilt;
    }
  }

  console.log(`Compiling ${lang} parser with ${module} to ${output}`);

  if (!fs.existsSync(module)) {
    console.error("[Missing] No module found for " + lang);
    continue;
  }

  let executable = path.join(__dirname, "..", "node_modules", ".bin", "tree-sitter");

  if (os.platform() === "win32") {
    executable += ".cmd";
  }

  executable = path.resolve(executable);

  function buildWasm(callback?: any) {
    const prebuiltFullPath = path.join(module, prebuilt);
    const wasmOutputFullPath = path.join(parsersDir, lang + ".wasm");

    if (fs.existsSync(prebuiltFullPath)) {
      console.log("[Prebuilt] Using prebuilt parser for " + lang);
      fs.copyFileSync(prebuiltFullPath, wasmOutputFullPath);
      return callback && callback();
    }

    console.log("[Compile] No prebuilt parser found for " + lang + ", building from source");
    exec(`${executable} build --wasm ${module}`,
      (err: any) => {
        if (err) {
          console.error("[Compile] Failed to build wasm for " + lang + ": " + err.message);
          return callback && callback(err);
        }

        fs.rename(
          output,
          wasmOutputFullPath,
          (err: any) => {
            if (err) {
              console.error("[Compile] Failed to copy built parser: " + err.message);
              return callback && callback(err);
            }
            console.log("[Compile] Successfully compiled " + lang + " parser");
            callback && callback();
          });
      });
  }

  if (mapping?.generate === true) {
    exec(`${executable} generate`, {
      cwd: module,
    }, (err: any) => {
      if (err) {
        return console.error("[Generate] Failed to generate " + lang + ": " + err.message);
      }
      buildWasm();
    });
  } else {
    buildWasm();
  }
}
