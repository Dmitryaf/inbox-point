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
    const styles = await app.inject({
      method: 'GET',
      url: '/setup/style.css',
    });
    const remote = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/setup',
    });

    expect(local.statusCode).toBe(200);
    expect(local.body).toContain('Подключение Telegram');
    expect(local.body).toContain('Доставка ответов');
    expect(local.body).toContain('Резервная копия');
    expect(local.headers['content-security-policy']).toContain('style-src');
    expect(local.headers['cache-control']).toBe('no-store');
    expect(styles.statusCode).toBe(200);
    expect(styles.headers['content-type']).toContain('text/css');
    expect(remote.statusCode).toBe(404);
  });

  it('returns sanitized delivery failures only on loopback', async () => {
    const app = createApp(config);
    const retriedDeliveries: string[] = [];
    apps.add(app);
    registerSetupRoutes(
      app,
      new TelegramSetupController(
        {
          running: true,
          start: () => Promise.resolve(),
          stop: () => Promise.resolve(),
        },
        {
          load: () => Promise.resolve(undefined),
          save: () => Promise.resolve(),
        },
        'local',
      ),
      {
        findFailedDeliveries: () => [
          {
            attempts: 5,
            channel: 'telegram',
            createdAt: new Date('2026-09-01T12:00:00.000Z'),
            id: 'delivery-1',
            lastError:
              'Telegram API sendMessage failed: Forbidden: bot was blocked; private answer',
          },
        ],
        getDeliverySummary: () => ({ failed: 1, pending: 2 }),
        retryFailedDelivery: (deliveryId) => {
          if (
            deliveryId !== 'delivery-1' ||
            retriedDeliveries.includes(deliveryId)
          ) {
            return false;
          }
          retriedDeliveries.push(deliveryId);
          return true;
        },
      },
      {
        createBackup: () =>
          Promise.resolve({
            createdAt: new Date('2026-09-01T12:30:00.000Z'),
            fileName: 'messenger-handoff-backup.sqlite',
            path: 'C:\\private\\messenger-handoff-backup.sqlite',
          }),
      },
    );

    const local = await app.inject({
      method: 'GET',
      url: '/api/setup/deliveries',
    });
    const remote = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/setup/deliveries',
    });
    const retry = await app.inject({
      method: 'POST',
      payload: { deliveryId: 'delivery-1' },
      url: '/api/setup/deliveries/retry',
    });
    const repeatedRetry = await app.inject({
      method: 'POST',
      payload: { deliveryId: 'delivery-1' },
      url: '/api/setup/deliveries/retry',
    });
    const remoteRetry = await app.inject({
      method: 'POST',
      payload: { deliveryId: 'delivery-1' },
      remoteAddress: '192.0.2.10',
      url: '/api/setup/deliveries/retry',
    });
    const backup = await app.inject({
      method: 'POST',
      payload: {},
      url: '/api/setup/backups',
    });
    const remoteBackup = await app.inject({
      method: 'POST',
      payload: {},
      remoteAddress: '192.0.2.10',
      url: '/api/setup/backups',
    });

    expect(local.statusCode).toBe(200);
    expect(local.json()).toEqual({
      failures: [
        {
          attempts: 5,
          channel: 'Telegram',
          createdAt: '2026-09-01T12:00:00.000Z',
          id: 'delivery-1',
          reason:
            'Бот не может написать клиенту. Возможно, клиент заблокировал бота.',
        },
      ],
      summary: { failed: 1, pending: 2 },
    });
    expect(local.body).not.toContain('private answer');
    expect(local.body).not.toContain('Forbidden');
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual({ queued: true });
    expect(retriedDeliveries).toEqual(['delivery-1']);
    expect(repeatedRetry.statusCode).toBe(409);
    expect(backup.statusCode).toBe(200);
    expect(backup.json()).toEqual({
      createdAt: '2026-09-01T12:30:00.000Z',
      fileName: 'messenger-handoff-backup.sqlite',
    });
    expect(backup.body).not.toContain('C:\\private');
    expect(remote.statusCode).toBe(404);
    expect(remoteRetry.statusCode).toBe(404);
    expect(remoteBackup.statusCode).toBe(404);
  });
});
