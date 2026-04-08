import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import * as jsonc from 'jsonc-parser';

import { ComplexScopeTrie } from '../ComplexScopeTrie';

function loadComplexScopes(grammarFile: string) {
  const filePath = path.resolve(__dirname, '../../grammars', grammarFile);
  const grammarJson = jsonc.parse(fs.readFileSync(filePath).toString());
  return grammarJson.complexScopes as { [scope: string]: string };
}

describe('ComplexScopeTrie', () => {
  it('prefers the deepest PHP scope over shallower fallbacks', () => {
    const trie = new ComplexScopeTrie(loadComplexScopes('php.json'));

    const term = trie.resolve(
      [{ scope: 'name', order: 0 }],
      ['qualified_name', 'catch_clause']);

    assert.strictEqual(term, 'type');
  });

  it('resolves PHP function calls ahead of qualified name fallbacks', () => {
    const trie = new ComplexScopeTrie(loadComplexScopes('php.json'));

    const term = trie.resolve(
      [{ scope: 'name', order: 0 }],
      ['function_call_expression']);

    assert.strictEqual(term, 'function');
  });

  it('preserves ordered scope precedence for sibling-sensitive matches', () => {
    const trie = new ComplexScopeTrie({
      'identifier': 'variable',
      'method_declaration > identifier[-2]': 'type',
      'method_declaration > identifier[-1]': 'parameter',
    });

    const term = trie.resolve(
      [
        { scope: 'identifier', order: 0 },
        { scope: 'identifier[-2]', order: 1 },
        { scope: 'identifier[-1]', order: 2 },
      ],
      ['method_declaration']);

    assert.strictEqual(term, 'parameter');
  });
});
