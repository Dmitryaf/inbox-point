import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// Modules scope classes, whereas Vue scoped styles also scope bare tags.
// This guard covers formatted tag selectors, including those inside @media.
function unscopedTags(css: string): string[] {
  return css
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) =>
      /^(?!from\b|to\b)[a-z][\w-]*(?:\s*[,>{[+~]|::?[\w-]+)/iu.test(line),
    );
}
async function modules(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? modules(join(directory, entry.name))
        : Promise.resolve(
            entry.name.endsWith('.module.css')
              ? [join(directory, entry.name)]
              : [],
          ),
    ),
  );
  return nested.flat();
}
it('detects actual bare-tag leakage and permits class-scoped tags, global tokens and keyframes', () => {
  expect(
    unscopedTags(
      'article {\n color: red;\n}\np,\nh3 {\n margin: 0;\n}\n@media (max-width: 520px) {\n button {\n width: 100%;\n }\n}',
    ),
  ).toEqual(['article {', 'p,', 'h3 {', 'button {']);
  expect(
    unscopedTags(
      '.channels article {\n color: red;\n}\n.card p {\n margin: 0;\n}\n:global(.token) {\n display: grid;\n}\n@keyframes enter {\n from {\n opacity: 0;\n }\n to {\n opacity: 1;\n }\n}',
    ),
  ).toEqual([]);
});
it('keeps all React CSS Module tag selectors inside an explicit class boundary', async () => {
  const paths = await modules('frontend/src');
  expect(paths.length).toBeGreaterThan(20);
  const violations = await Promise.all(
    paths.map(async (path) => ({
      path,
      selectors: unscopedTags(await readFile(path, 'utf8')),
    })),
  );
  expect(violations.filter((result) => result.selectors.length > 0)).toEqual(
    [],
  );
});
