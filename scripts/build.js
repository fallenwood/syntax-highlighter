#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require("os");

// Languages
let langs = [];
fs.readdirSync(__dirname + "/../grammars/").forEach(name => {
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
    ocaml:{
        module: ["ocaml", "ocaml"],
        output: "ocaml",
    },
    shellscript:{
        module: ["bash"],
        output: "bash",
    },
    csharp: {
        module: ["c-sharp"],
        output: "c_sharp",
    },
}

// Build wasm parsers for supported languages
const parsersDir = path.resolve(path.join(__dirname, "..", "parsers"));
if (!fs.existsSync(parsersDir)) {
    fs.mkdirSync(parsersDir);
}
for (li of langs) {
    const lang = li;
    let module = path.resolve(path.join(__dirname, "..", "node_modules", `tree-sitter-${lang}`));
    let output = "tree-sitter-" + lang + ".wasm";

    if (langMap[lang]) {
        module = path.join(
            __dirname,
            "..",
            "node_modules",
            "tree-sitter-" + langMap[lang].module[0],
            ...langMap[lang].module.slice(1),
        );

        output = "tree-sitter-" + langMap[lang].output + ".wasm";
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

    exec(`${executable} build-wasm ${module}`,
        (err) => {
            if (err) {
                console.error("Failed to build wasm for " + lang + ": " + err.message);
            } else {
                fs.rename(
                    output,
                    "parsers/" + lang + ".wasm",
                    (err) => {
                        if (err) {
                            console.error("Failed to copy built parser: " + err.message);
                        }
                        else {
                            console.log("Successfully compiled " + lang + " parser");
                        }
                    });
            }
        });
}
