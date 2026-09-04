import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ManagementAssets {
  html: string;
  script: string;
  styles: string;
}

export function loadManagementAssets(
  root = resolve(process.cwd(), 'dist', 'manage'),
): ManagementAssets {
  try {
    return {
      html: readFileSync(resolve(root, 'index.html'), 'utf8'),
      script: readFileSync(resolve(root, 'app.js'), 'utf8'),
      styles: readFileSync(resolve(root, 'style.css'), 'utf8'),
    };
  } catch (error: unknown) {
    throw new Error(
      'Management frontend assets are missing; run npm.cmd run build:frontend',
      { cause: error },
    );
  }
}
