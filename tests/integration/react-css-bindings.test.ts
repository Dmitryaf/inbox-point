import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}
function cssSource(path: string): string {
  return readFileSync(path, 'utf8').replace(
    /@import '([^']+)';/gu,
    (_match: string, name: string) => cssSource(resolve(dirname(path), name)),
  );
}
function missingBindings(
  source: string,
  css: string,
  binding: string,
): string[] {
  const classes = new Set(
    [...css.matchAll(/\.([a-zA-Z][\w-]*)/gu)].map((match) => match[1]),
  );
  const references = new RegExp(
    `${binding}(?:\\.([\\w-]+)|\\['([^']+)'\\])`,
    'gu',
  );
  return [...source.matchAll(references)]
    .map((match) => match[1] ?? match[2] ?? '')
    .filter((name) => !classes.has(name));
}
it('rejects missing static CSS Module bindings instead of rendering undefined class names', () => {
  expect(
    missingBindings(
      "styles.preview styles['missing']",
      '.card > h2 { margin: 0; }',
      'styles',
    ),
  ).toEqual(['preview', 'missing']);
  expect(
    missingBindings(
      "styles.card styles['card']",
      '.card > h2 { margin: 0; }',
      'styles',
    ),
  ).toEqual([]);
});
it('keeps actual TSX CSS Module bindings defined, including imported styles', () => {
  const sources = files('frontend/src').filter((path) => path.endsWith('.tsx'));
  expect(sources.length).toBeGreaterThan(20);
  const violations = sources.flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    return [
      ...source.matchAll(
        /import (\w+) from '(@frontend\/[^']+\.module\.css)'/gu,
      ),
    ].flatMap((match) => {
      const css = cssSource(match[2]!.replace('@frontend/', 'frontend/src/'));
      return missingBindings(source, css, match[1]!).map((binding) => ({
        path,
        binding,
      }));
    });
  });
  expect(violations).toEqual([]);
});
