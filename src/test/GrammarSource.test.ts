import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { listGrammarLanguages, loadGrammarSource } from '../GrammarSource';

describe('GrammarSource', () => {
  it('loads .scm grammars', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syntax-highlighter-grammar-'));

    try {
      fs.writeFileSync(path.join(tempDir, 'demo.scm'), '(identifier) @variable');

      const source = loadGrammarSource(tempDir, 'demo');

      assert.ok(source.filePath.endsWith('demo.scm'));
      assert.strictEqual(source.source, '(identifier) @variable');
    }
    finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws when a scm grammar is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syntax-highlighter-grammar-'));

    try {
      assert.throws(() => loadGrammarSource(tempDir, 'demo'));
    }
    finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lists only scm grammar languages', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syntax-highlighter-grammar-'));

    try {
      fs.writeFileSync(path.join(tempDir, 'demo.scm'), '(identifier) @variable');
      fs.writeFileSync(path.join(tempDir, 'demo.txt'), 'ignored');
      fs.writeFileSync(path.join(tempDir, 'other.md'), 'ignored');
      fs.writeFileSync(path.join(tempDir, 'second.scm'), '(identifier) @function');

      const languages = listGrammarLanguages(tempDir).sort();

      assert.deepStrictEqual(languages, ['demo', 'second']);
    }
    finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
