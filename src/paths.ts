import * as path from 'path';

const extensionRoot = path.resolve(__dirname, '..', '..');

export function getExtensionAssetPath(...segments: string[]) {
  return path.join(extensionRoot, ...segments);
}
