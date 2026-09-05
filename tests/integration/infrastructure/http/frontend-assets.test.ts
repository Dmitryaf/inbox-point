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
  it.each(['/manage', '/ops', '/setup'] as const)(
    'scopes the shared bundle to %s',
    async (routeBase) => {
      const directory = await mkdtemp(join(tmpdir(), 'mh-frontend-assets-'));
      directories.push(directory);
      await Promise.all([
        writeFile(
          join(directory, 'index.html'),
          '<script src="./app.js"></script><link href="./style.css">',
        ),
        writeFile(join(directory, 'app.js'), 'globalThis.app = true;'),
        writeFile(join(directory, 'style.css'), ':root { color: black; }'),
      ]);

      const assets = loadFrontendAssets(routeBase, directory);

      expect(assets.html).toContain(`src="${routeBase}/app.js"`);
      expect(assets.html).toContain(`href="${routeBase}/style.css"`);
    },
  );
});
