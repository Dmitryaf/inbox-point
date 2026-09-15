import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface FrontendAssets {
  html: string;
  icon: string;
  socialPreview: Buffer;
  script: string;
  styles: string;
}

export function loadFrontendAssets(
  root = resolve(process.cwd(), 'dist', 'frontend'),
): FrontendAssets {
  try {
    return {
      html: readFileSync(resolve(root, 'index.html'), 'utf8'),
      icon: readFileSync(resolve(root, 'favicon.svg'), 'utf8'),
      socialPreview: readFileSync(
        resolve(root, 'inbox-point-social-preview.png'),
      ),
      script: readFileSync(resolve(root, 'app.js'), 'utf8'),
      styles: readFileSync(resolve(root, 'style.css'), 'utf8'),
    };
  } catch (error: unknown) {
    throw new Error(
      'Frontend assets are missing; run npm.cmd run build:frontend',
      { cause: error },
    );
  }
}
