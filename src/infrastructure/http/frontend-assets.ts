import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface FrontendAssets {
  html: string;
  script: string;
  styles: string;
}

export function loadFrontendAssets(
  routeBase: '/manage' | '/ops' | '/setup',
  root = resolve(process.cwd(), 'dist', 'frontend'),
): FrontendAssets {
  try {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');

    return {
      html: scopeAssetPaths(html, routeBase),
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

function scopeAssetPaths(
  html: string,
  routeBase: '/manage' | '/ops' | '/setup',
): string {
  return html.replaceAll('="./', `="${routeBase}/`);
}
