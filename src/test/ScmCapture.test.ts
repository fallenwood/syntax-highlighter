import * as assert from 'assert';

import { resolveScmCaptureTerm } from '../ScmCapture';

describe('resolveScmCaptureTerm', () => {
  it('maps direct semantic captures unchanged', () => {
    assert.strictEqual(resolveScmCaptureTerm('type'), 'type');
    assert.strictEqual(resolveScmCaptureTerm('parameter'), 'parameter');
  });

  it('maps common Tree-sitter highlight captures to extension terms', () => {
    assert.strictEqual(resolveScmCaptureTerm('module'), 'scope');
    assert.strictEqual(resolveScmCaptureTerm('function.method'), 'function');
    assert.strictEqual(resolveScmCaptureTerm('variable.builtin'), 'variable');
    assert.strictEqual(resolveScmCaptureTerm('punctuation.bracket'), 'punctuation');
    assert.strictEqual(resolveScmCaptureTerm('keyword.control.conditional'), 'control');
    assert.strictEqual(resolveScmCaptureTerm('keyword.directive.import'), 'directive');
  });

  it('ignores internal helper captures', () => {
    assert.strictEqual(resolveScmCaptureTerm('__name__'), undefined);
  });
});
