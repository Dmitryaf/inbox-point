import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const frontendRoot = resolve(process.cwd(), 'frontend', 'src');
const stylesRoot = join(frontendRoot, 'app', 'styles');
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}
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
  it('separates React components from adjacent CSS Modules', () => {
    const css = files(frontendRoot).filter((file) => file.endsWith('.css'));
    expect(css.length).toBeGreaterThan(20);
    const misplaced = css
      .filter(
        (file) =>
          dirname(file) !== stylesRoot &&
          (basename(dirname(file)) !== 'styles' ||
            !file.endsWith('.module.css')),
      )
      .map((file) => relative(frontendRoot, file));
    expect(misplaced).toEqual([]);
    expect(files(frontendRoot).filter((file) => file.endsWith('.vue'))).toEqual(
      [],
    );
    expect(existsSync(join(frontendRoot, 'App.tsx'))).toBe(false);
    expect(existsSync(join(frontendRoot, 'app', 'App.tsx'))).toBe(true);
  });
  it('keeps component colors behind semantic tokens', () => {
    const violations = files(frontendRoot)
      .filter(
        (file) =>
          /\.(?:css|tsx)$/.test(file) &&
          file !== join(stylesRoot, 'tokens.css'),
      )
      .filter((file) => /#[\da-f]{3,8}\b/i.test(readFileSync(file, 'utf8')))
      .map((file) => relative(frontendRoot, file));
    expect(violations).toEqual([]);
    expect(readFileSync(join(stylesRoot, 'tokens.css'), 'utf8')).not.toMatch(
      /--color-(?:accent|background-accent)\s*:/,
    );
  });
});
