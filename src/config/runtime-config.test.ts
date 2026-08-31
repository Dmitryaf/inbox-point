import { describe, expect, it } from 'vitest';

import { loadRuntimeConfig } from './runtime-config.js';

describe('loadRuntimeConfig', () => {
  it('returns safe defaults for an empty environment', () => {
    expect(loadRuntimeConfig({})).toEqual({
      databasePath: './data/messenger-handoff.sqlite',
      host: '127.0.0.1',
      logLevel: 'info',
      nodeEnv: 'development',
      port: 3000,
    });
  });

  it('rejects an invalid port without including unrelated environment data', () => {
    const load = (): void => {
      loadRuntimeConfig({
        PORT: '70000',
        TELEGRAM_BOT_TOKEN: 'must-not-appear',
      });
    };

    expect(load).toThrowError('Invalid runtime configuration: PORT:');
    expect(load).not.toThrowError(/must-not-appear/);
  });
});
