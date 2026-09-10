import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import * as ts from 'typescript';

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

  it('separates React components from their scoped styles', () => {
    const components = tsxFiles(frontendRoot);
    const styleImports = components.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [
        ...source.matchAll(
          /import\s+(?:[^;'"\n]+?\s+from\s+)?['"]([^'"]+\.css)['"]/g,
        ),
      ]
        .map((match) => ({ file, source, specifier: match[1] ?? '' }))
        .map((entry) => ({
          ...entry,
          cssPath: entry.specifier.startsWith('@frontend/')
            ? resolve(frontendRoot, entry.specifier.slice('@frontend/'.length))
            : resolve(dirname(file), entry.specifier),
        }))
        .filter(({ cssPath }) => dirname(cssPath) !== stylesRoot);
    });
    const unscoped = styleImports
      .filter(({ file, cssPath }) => {
        const scope = /\.react-(data-r-[a-f0-9]+)\.css$/.exec(
          basename(cssPath),
        )?.[1];
        if (!scope || !existsSync(cssPath)) {
          return true;
        }
        const css = readFileSync(cssPath, 'utf8');
        const selectors = [...css.matchAll(/\[(data-r-[a-f0-9]+)\]/g)].map(
          (match) => match[1],
        );
        // Explicit global selectors remain valid; locally scoped selectors must
        // use the component marker that the emitted JSX actually supplies.
        const markers = renderedScopeMarkers(file);
        return (
          !markers.has(scope) ||
          [...markers].some((value) => value !== scope) ||
          !selectors.includes(scope) ||
          selectors.some((value) => value !== scope)
        );
      })
      .map(({ file }) => relative(frontendRoot, file));
    const misplacedSources = styleImports
      .filter(
        ({ specifier, cssPath }) =>
          !specifier.includes('styles/') ||
          basename(dirname(cssPath)) !== 'styles',
      )
      .map(({ file }) => relative(frontendRoot, file));
    const misplacedFiles = styleFiles(frontendRoot)
      .filter((file) => file.endsWith('.css'))
      .filter(
        (file) =>
          dirname(file) !== stylesRoot && basename(dirname(file)) !== 'styles',
      )
      .map((file) => relative(frontendRoot, file));

    expect(components.length).toBeGreaterThan(0);
    expect(styleImports.length).toBeGreaterThan(0);
    expect(unscoped).toEqual([]);
    expect(misplacedSources).toEqual([]);
    expect(misplacedFiles).toEqual([]);
    expect(existsSync(join(frontendRoot, 'App.tsx'))).toBe(false);
    expect(existsSync(join(frontendRoot, 'app', 'App.tsx'))).toBe(true);
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

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return tsxFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : [];
  });
}

function styleFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return styleFiles(path);
    }
    return entry.isFile() && /\.(?:css|tsx)$/.test(entry.name) ? [path] : [];
  });
}

interface RenderValue {
  node: ts.Node;
  file: string;
  bindings: Map<string, RenderValue>;
}

function renderedScopeMarkers(component: string): Set<string> {
  const markers = new Set<string>();
  const active = new Set<string>();
  const visited = new Set<ts.Node>();
  const marker = (name: string) => {
    if (/^data-r-[a-f0-9]+$/.test(name)) {
      markers.add(name);
    }
  };
  const spread = (value: RenderValue): void => {
    const { node, bindings } = value;
    if (ts.isIdentifier(node)) {
      const binding = bindings.get(node.text);
      if (binding) {
        spread(binding);
      }
    } else if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) {
          marker(
            ts.isStringLiteral(property.name)
              ? property.name.text
              : property.name.getText(),
          );
        } else if (ts.isSpreadAssignment(property)) {
          spread({ ...value, node: property.expression });
        }
      }
    } else if (ts.isParenthesizedExpression(node)) {
      spread({ ...value, node: node.expression });
    }
  };
  const render = (
    file: string,
    exported: string,
    arguments_: RenderValue[] = [],
  ): void => {
    const key = file + ':' + exported;
    if (active.has(key) || !existsSync(file)) {
      return;
    }
    active.add(key);
    const tree = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const imports = new Map<string, { file: string; exported: string }>();
    let entry: ts.FunctionDeclaration | undefined;
    for (const statement of tree.statements) {
      if (ts.isFunctionDeclaration(statement)) {
        const isDefault = statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
        );
        if (
          exported === 'default' ? isDefault : statement.name?.text === exported
        ) {
          entry = statement;
        }
      }
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (
        !specifier.startsWith('.') ||
        !clause ||
        clause.isTypeOnly ||
        !clause.namedBindings ||
        !ts.isNamedImports(clause.namedBindings)
      ) {
        continue;
      }
      const target = resolve(
        dirname(file),
        specifier.replace(/\.(?:js|tsx)$/, '') + '.tsx',
      );
      for (const binding of clause.namedBindings.elements) {
        if (!binding.isTypeOnly) {
          imports.set(binding.name.text, {
            file: target,
            exported: binding.propertyName?.text ?? binding.name.text,
          });
        }
      }
    }
    if (!entry?.body) {
      active.delete(key);
      return;
    }
    const bindings = new Map<string, RenderValue>();
    entry.parameters.forEach((parameter, index) => {
      const argument = arguments_[index];
      if (argument && ts.isIdentifier(parameter.name)) {
        bindings.set(parameter.name.text, argument);
      }
    });
    const collect = (node: ts.Node): void => {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      ) {
        return;
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        bindings.set(node.name.text, {
          node: node.initializer,
          file,
          bindings,
        });
      }
      ts.forEachChild(node, collect);
    };
    collect(entry.body);
    const visit = (node: ts.Node, current: RenderValue): void => {
      if (visited.has(node)) {
        return;
      }
      visited.add(node);
      if (ts.isIdentifier(node)) {
        const binding = current.bindings.get(node.text);
        if (binding) {
          visit(binding.node, binding);
        }
      }
      if (ts.isJsxAttribute(node)) {
        marker(node.name.getText());
      }
      if (ts.isJsxSpreadAttribute(node)) {
        spread({ ...current, node: node.expression });
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const imported = imports.get(node.expression.text);
        if (imported?.exported.startsWith('render')) {
          render(
            imported.file,
            imported.exported,
            node.arguments.map((argument) => ({ ...current, node: argument })),
          );
        }
      }
      ts.forEachChild(node, (child) => visit(child, current));
    };
    const returns = (node: ts.Node): void => {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      ) {
        return;
      }
      if (ts.isReturnStatement(node) && node.expression) {
        visit(node.expression, { node: node.expression, file, bindings });
      } else {
        ts.forEachChild(node, returns);
      }
    };
    returns(entry.body);
    active.delete(key);
  };
  render(component, 'default');
  return markers;
}
