import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface OperationsAssets {
  html: string;
  script: string;
  styles: string;
}

export function loadOperationsAssets(
  root = resolve(process.cwd(), 'dist', 'ops'),
): OperationsAssets {
  try {
    return {
      html: readFileSync(resolve(root, 'index.html'), 'utf8'),
      script: readFileSync(resolve(root, 'app.js'), 'utf8'),
      styles: readFileSync(resolve(root, 'style.css'), 'utf8'),
    };
  } catch (error: unknown) {
    throw new Error(
      'Operations frontend assets are missing; run npm.cmd run build:frontend',
      { cause: error },
    );
  }
}
