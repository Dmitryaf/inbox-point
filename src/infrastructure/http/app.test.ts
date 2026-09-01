import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';
import { createApp, registerSetupRoutes } from './app.js';

const config: RuntimeConfig = {
  databasePath: './data/test.sqlite',
  host: '127.0.0.1',
  logLevel: 'silent',
  nodeEnv: 'test',
  port: 3000,
};

const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('HTTP service status', () => {
  it('serves the React entry and compiled frontend resources', async () => {
    const app = createApp(config);
    apps.add(app);
    const html = await app.inject({ method: 'GET', url: '/' });
    expect(html.statusCode).toBe(200);
    expect(html.headers['content-type']).toContain('text/html');
    expect(html.body).toContain('id="app"');
    expect(html.body).toContain('/app.js');
    for (const path of ['/app.js', '/style.css']) {
      const response = await app.inject({ method: 'GET', url: path });
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    }
  });
  it('returns liveness status', async () => {
    const app = createApp(config);
    apps.add(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('reports delivery state without exposing message content', async () => {
    const app = createApp(config, () => ({ failed: 2, pending: 3 }));
    apps.add(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      deliveries: { failed: 2, pending: 3 },
      status: 'ready',
    });
  });

  it('fails readiness when delivery state cannot be read', async () => {
    const app = createApp(config, () => {
      throw new Error('Database unavailable');
    });
    apps.add(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'not_ready' });
  });

  it('serves setup only on the loopback interface', async () => {
    const app = createApp(config);
    apps.add(app);
    registerSetupRoutes(
      app,
      new TelegramSetupController(
        {
          running: false,
          start: () => Promise.resolve(),
          stop: () => Promise.resolve(),
        },
        {
          load: () => Promise.resolve(undefined),
          save: () => Promise.resolve(),
        },
        'none',
      ),
    );

    const local = await app.inject({ method: 'GET', url: '/setup' });
    const remote = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/setup',
    });

    expect(local.statusCode).toBe(200);
    expect(local.body).toContain('Подключение Telegram');
    expect(local.headers['cache-control']).toBe('no-store');
    expect(remote.statusCode).toBe(404);
  });
});
