const directTerms = new Set([
  'type',
  'scope',
  'function',
  'variable',
  'number',
  'string',
  'comment',
  'constant',
  'directive',
  'control',
  'operator',
  'modifier',
  'punctuation',
  'async',
  'parameter',
]);

function hasPrefix(capture: string, prefix: string) {
  return capture === prefix || capture.startsWith(`${prefix}.`);
}

export function resolveScmCaptureTerm(captureName: string): string | undefined {
  const capture = captureName.replace(/^@/, '');

  if (!capture || capture.startsWith('__')) {
    return undefined;
  }

  if (directTerms.has(capture)) {
    return capture;
  }

  if (hasPrefix(capture, 'parameter')) {
    return 'parameter';
  }

  if (hasPrefix(capture, 'module') || hasPrefix(capture, 'namespace')) {
    return 'scope';
  }

  if (hasPrefix(capture, 'type')) {
    return 'type';
  }

  if (hasPrefix(capture, 'constructor')) {
    return 'function';
  }

  if (hasPrefix(capture, 'function') || hasPrefix(capture, 'method')) {
    return 'function';
  }

  if (
    hasPrefix(capture, 'variable') ||
    hasPrefix(capture, 'property') ||
    hasPrefix(capture, 'field') ||
    hasPrefix(capture, 'attribute')
  ) {
    return 'variable';
  }

  if (hasPrefix(capture, 'string') || hasPrefix(capture, 'character') || hasPrefix(capture, 'char')) {
    return 'string';
  }

  if (hasPrefix(capture, 'number') || hasPrefix(capture, 'float') || hasPrefix(capture, 'integer')) {
    return 'number';
  }

  if (hasPrefix(capture, 'comment')) {
    return 'comment';
  }

  if (hasPrefix(capture, 'constant') || hasPrefix(capture, 'boolean')) {
    return 'constant';
  }

  if (hasPrefix(capture, 'operator')) {
    return 'operator';
  }

  if (hasPrefix(capture, 'punctuation') || hasPrefix(capture, 'delimiter') || hasPrefix(capture, 'bracket')) {
    return 'punctuation';
  }

  if (hasPrefix(capture, 'keyword.directive') || hasPrefix(capture, 'keyword.import') || hasPrefix(capture, 'tag')) {
    return 'directive';
  }

  if (hasPrefix(capture, 'keyword.control')) {
    return 'control';
  }

  if (hasPrefix(capture, 'keyword.operator')) {
    return 'operator';
  }

  if (hasPrefix(capture, 'keyword.async')) {
    return 'async';
  }

  if (hasPrefix(capture, 'modifier')) {
    return 'modifier';
  }

  if (hasPrefix(capture, 'keyword')) {
    return 'control';
  }

  return undefined;
}
