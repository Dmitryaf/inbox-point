import { build } from 'vite';
import { expect, it } from 'vitest';

it.each(['production', 'react'])(
  'keeps the %s frontend self-contained and compatible with Fastify assets',
  async (mode) => {
    let modules: string[] = [];
    let outputDirectory = '';
    const result = await build({
      configFile: 'frontend/vite.config.ts',
      mode,
      logLevel: 'silent',
      build: { write: false },
      plugins: [
        {
          name: 'observe-frontend-modules',
          configResolved(config) {
            outputDirectory = config.build.outDir.replaceAll('\\', '/');
          },
          generateBundle(_options, bundle) {
            modules = Object.values(bundle)
              .flatMap((entry) =>
                entry.type === 'chunk' ? Object.keys(entry.modules) : [],
              )
              .map((id) => id.replaceAll('\\', '/'));
          },
        },
      ],
    });
    if (Array.isArray(result) || !('output' in result)) {
      throw new Error('Expected one frontend bundle');
    }
    const scripts = result.output.filter((entry) => entry.type === 'chunk');
    expect(outputDirectory).toMatch(
      mode === 'react' ? /\/dist\/frontend-react$/ : /\/dist\/frontend$/,
    );
    expect(scripts.map((entry) => entry.fileName)).toEqual(['app.js']);
    expect(
      scripts.flatMap((entry) => [...entry.imports, ...entry.dynamicImports]),
    ).toEqual([]);
    expect(result.output.map((entry) => entry.fileName)).toEqual(
      expect.arrayContaining(['index.html', 'style.css']),
    );
    expect(
      modules.some((id) => /node_modules\/(react|react-dom)\//.test(id)),
    ).toBe(mode === 'react');
    expect(modules.some((id) => /node_modules\/(vue|@vue)\//.test(id))).toBe(
      mode !== 'react',
    );
  },
  30_000,
);
