import * as fs from 'fs';
import * as path from 'path';

export type GrammarSource = {
  filePath: string;
  source: string;
};

export function loadGrammarSource(grammarDir: string, lang: string): GrammarSource {
  const filePath = path.join(grammarDir, `${lang}.scm`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`No grammar source found for ${lang} in ${grammarDir}`);
  }

  return {
    filePath,
    source: fs.readFileSync(filePath, 'utf8'),
  };
}

export function listGrammarLanguages(grammarDir: string) {
  const languages = new Set<string>();

  for (const entry of fs.readdirSync(grammarDir)) {
    const ext = path.extname(entry);

    if (ext !== '.scm') {
      continue;
    }

    languages.add(path.basename(entry, ext));
  }

  return [...languages];
}
