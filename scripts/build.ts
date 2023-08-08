#!/usr/bin/env node

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require("os");

let skipExising = true;

if (process.argv.includes("--rebuild")) {
  skipExising = false;
}

// Languages
let langs: string[] = [];
fs.readdirSync(__dirname + "/../grammars/").forEach((name: string) => {
  langs.push(path.basename(name, ".json"));
});

// Language-package map
const langMap = {
  typescript: {
    module: ["typescript", "typescript"],
    output: "typescript",
  },
  typescriptreact: {
    module: ["typescript", "tsx"],
    output: "tsx",
  },
  ocaml: {
    module: ["ocaml", "ocaml"],
    output: "ocaml",
  },
  shellscript: {
    module: ["bash"],
    output: "bash",
  },
  csharp: {
    module: ["c-sharp"],
    output: "c_sharp",
  },
} as any;

// Build wasm parsers for supported languages
const parsersDir = path.resolve(path.join(__dirname, "..", "parsers"));
if (!fs.existsSync(parsersDir)) {
  fs.mkdirSync(parsersDir);
}
for (let li of langs) {
  const lang = li;
  let module = path.resolve(path.join(__dirname, "..", "node_modules", `tree-sitter-${lang}`));
  let output = "tree-sitter-" + lang + ".wasm";

  let mapping = langMap[lang];

  if (mapping) {
    module = path.join(
      __dirname,
      "..",
      "node_modules",
      "tree-sitter-" + mapping.module[0],
      ...mapping.module.slice(1),
    );

    output = "tree-sitter-" + mapping.output + ".wasm";
  }

  if (skipExising && fs.existsSync("parsers/" + lang + ".wasm")) {
    console.log(`Skipping existing ${lang}.wasm`);
    continue;
  }

  console.log(`Compiling ${lang} parser with ${module} to ${output}`);

  if (!fs.existsSync(module)) {
    console.error("No module found for " + lang);
    continue;
  }

  let executable = path.join(__dirname, "..", "node_modules", ".bin", "tree-sitter");

  if (os.platform() === "win32") {
    executable += ".cmd";
  }

  executable = path.resolve(executable);

  function buildWasm(callback?: any) {
    exec(`${executable} build-wasm ${module}`,
      (err: any) => {
        if (err) {
          console.error("Failed to build wasm for " + lang + ": " + err.message);
          return callback && callback(err);
        }

        fs.rename(
          output,
          "parsers/" + lang + ".wasm",
          (err: any) => {
            if (err) {
              console.error("Failed to copy built parser: " + err.message);
              return callback && callback(err);
            }
            console.log("Successfully compiled " + lang + " parser");
            callback && callback();
          });
      });
  }

  if (lang === "d") {
    exec(`${executable} generate`, {
      cwd: module,
    }, (err: any) => {
      if (err) {
        return console.error("Failed generate " + lang + ": " + err.message);
      }
      buildWasm();
    });
  } else if (lang === "fsharp"){
    exec(`${executable} generate`, {
      cwd: module,
      env: {
        ...process.env,
        "CC": "clang++",
      },
    }, (err: any) => {
      if (err) {
        return console.error("Failed generate " + lang + ": " + err.message);
      }
      buildWasm();
    });
  } else {
    buildWasm();
  }
}
