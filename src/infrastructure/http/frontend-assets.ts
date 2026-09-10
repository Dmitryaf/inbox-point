import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface FrontendAssets {
  html: string;
  icon: string;
  script: string;
  styles: string;
}

export type FrontendRouteBase = '/manage' | '/ops' | '/setup';

export function loadFrontendAssets(
  routeBase: FrontendRouteBase,
  root = resolve(process.cwd(), 'dist', 'frontend'),
): FrontendAssets {
  try {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');

    return {
      html: scopeAssetPaths(html, routeBase),
      icon: readFileSync(resolve(root, 'favicon.svg'), 'utf8'),
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

function scopeAssetPaths(html: string, routeBase: FrontendRouteBase): string {
  return html.replaceAll('="./', `="${routeBase}/`);
}
