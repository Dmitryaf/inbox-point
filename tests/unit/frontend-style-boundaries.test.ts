import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const frontendRoot = resolve(process.cwd(), 'frontend', 'src');
const stylesRoot = join(frontendRoot, 'app', 'styles');

describe('frontend style boundaries', () => {
  it('keeps only tokens and shared foundations in the global entrypoint', () => {
    const globalCss = readFileSync(join(stylesRoot, 'global.css'), 'utf8');
    const imports = [...globalCss.matchAll(/@import\s+'([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(imports).toEqual(['./tokens.css', './foundation.css']);
    expect(
      readdirSync(stylesRoot)
        .filter((file) => file.endsWith('.css'))
        .sort(),
    ).toEqual(['foundation.css', 'global.css', 'tokens.css']);
  });

  it('separates Vue components from their scoped styles', () => {
    const styleBlocks = vueFiles(frontendRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(/<style\b([^>]*)>/g)].map((match) => ({
        attributes: match[1] ?? '',
        file,
      }));
    });
    const unscoped = styleBlocks
      .filter(({ attributes }) => !/\bscoped\b/.test(attributes))
      .map(({ file }) => relative(frontendRoot, file));
    const misplacedSources = styleBlocks
      .filter(({ attributes }) => !/\bsrc="[^"]*styles\//.test(attributes))
      .map(({ file }) => relative(frontendRoot, file));
    const misplacedFiles = styleFiles(frontendRoot)
      .filter((file) => file.endsWith('.css'))
      .filter(
        (file) =>
          dirname(file) !== stylesRoot && basename(dirname(file)) !== 'styles',
      )
      .map((file) => relative(frontendRoot, file));

    expect(unscoped).toEqual([]);
    expect(misplacedSources).toEqual([]);
    expect(misplacedFiles).toEqual([]);
    expect(existsSync(join(frontendRoot, 'App.vue'))).toBe(false);
    expect(existsSync(join(frontendRoot, 'app', 'App.vue'))).toBe(true);
  });

  it('keeps component colors behind semantic tokens', () => {
    const violations = styleFiles(frontendRoot)
      .filter((file) => file !== join(stylesRoot, 'tokens.css'))
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return /#[\da-f]{3,8}\b/i.test(source)
          ? [relative(frontendRoot, file)]
          : [];
      });

    expect(violations).toEqual([]);
    expect(readFileSync(join(stylesRoot, 'tokens.css'), 'utf8')).not.toMatch(
      /--color-(?:accent|background-accent)\s*:/,
    );
  });
});

function vueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return vueFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.vue') ? [path] : [];
  });
}

function styleFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return styleFiles(path);
    }
    return entry.isFile() && /\.(?:css|vue)$/.test(entry.name) ? [path] : [];
  });
}
