import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadFrontendAssets } from '@/infrastructure/http/frontend-assets.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe('loadFrontendAssets', () => {
  it('loads the shared frontend bundle without route-specific rewriting', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mh-frontend-assets-'));
    directories.push(directory);
    await Promise.all([
      writeFile(
        join(directory, 'index.html'),
        '<script src="./app.js"></script><link href="./style.css"><link rel="icon" href="./favicon.svg">',
      ),
      writeFile(join(directory, 'favicon.svg'), '<svg>icon</svg>'),
      writeFile(join(directory, 'app.js'), 'globalThis.app = true;'),
      writeFile(join(directory, 'style.css'), ':root { color: black; }'),
    ]);

    const assets = loadFrontendAssets(directory);

    expect(assets.html).toContain('src="./app.js"');
    expect(assets.html).toContain('href="./style.css"');
    expect(assets.html).toContain('href="./favicon.svg"');
    expect(assets.icon).toBe('<svg>icon</svg>');
  });
});
