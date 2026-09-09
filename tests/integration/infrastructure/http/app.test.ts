import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp, registerSetupRoutes } from '@/infrastructure/http/app.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';
import { VkSetupController } from '@/infrastructure/vk/vk-setup-controller.js';
import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import { registerReadinessRoute } from '@/modules/operations-monitoring/presentation/http/readiness-route.js';

const config: RuntimeConfig = {
  closedRequestRetentionDays: 7,
  databasePath: './data/test.sqlite',
  host: '127.0.0.1',
  logLevel: 'silent',
  nodeEnv: 'test',
  port: 3000,
};

const apps = new Set<ReturnType<typeof createApp>>();
const setupAssets = {
  html: '<div id="app">Подключение Telegram Подключение VK</div>',
  script: 'globalThis.setup = true;',
  styles: ':root { color: black; }',
};

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('HTTP service status', () => {
  it('returns liveness status', async () => {
    const app = createApp(config);
    apps.add(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('trusts forwarded client IP only from an immediate loopback proxy', async () => {
    const app = createApp(config);
    apps.add(app);
    app.get('/test/client-ip', (request) => ({ ip: request.ip }));

    const throughLocalProxy = await app.inject({
      headers: { 'x-forwarded-for': '198.51.100.24' },
      method: 'GET',
      remoteAddress: '127.0.0.1',
      url: '/test/client-ip',
    });
    const directRemote = await app.inject({
      headers: { 'x-forwarded-for': '198.51.100.99' },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/test/client-ip',
    });

    expect(throughLocalProxy.json()).toEqual({ ip: '198.51.100.24' });
    expect(directRemote.json()).toEqual({ ip: '192.0.2.10' });
  });

  it('reports readiness without exposing delivery state', async () => {
    const app = createApp(config);
    apps.add(app);
    registerReadinessRoute(
      app,
      createMonitoringService(() => ({ failed: 2, pending: 3 })),
    );

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready' });
    expect(response.body).not.toContain('deliveries');
  });

  it('fails readiness when delivery state cannot be read', async () => {
    const app = createApp(config);
    apps.add(app);
    registerReadinessRoute(
      app,
      createMonitoringService(() => {
        throw new Error('Database unavailable');
      }),
    );

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'not_ready' });
  });

  it('fails readiness without exposing which configured channel is stale', async () => {
    const app = createApp(config);
    apps.add(app);
    registerReadinessRoute(
      app,
      new OperationsMonitoringService({
        channelActivity: (channel) => {
          if (channel === 'telegram') {
            return {
              lastSuccessfulPollAt: new Date('2026-09-04T12:00:00.000Z'),
            };
          }
          return {};
        },
        clock: () => new Date('2026-09-04T12:03:00.000Z'),
        deliveryActivity: () => ({
          lastCycleAt: new Date('2026-09-04T12:02:59.000Z'),
          running: true,
        }),
        deliverySummary: () => ({ failed: 0, pending: 0 }),
        startedAt: new Date('2026-09-04T12:00:00.000Z'),
        telegramStatus: () => ({ connected: true, source: 'environment' }),
        vkStatus: () => ({ connected: false, source: 'none' }),
      }),
    );

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'not_ready' });
    expect(response.body).not.toContain('telegram');
  });

  it('allows setup without a password only from loopback in development', async () => {
    const app = createApp(config);
    apps.add(app);
    registerTestSetup(app, { allowLocalBypass: true });

    const localPage = await app.inject({ method: 'GET', url: '/setup' });
    const localStatus = await app.inject({
      method: 'GET',
      url: '/api/setup/status',
    });
    const styles = await app.inject({
      method: 'GET',
      url: '/setup/style.css',
    });
    const remotePage = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/setup',
    });

    expect(localPage.statusCode).toBe(200);
    expect(localPage.body).toContain('Подключение Telegram');
    expect(localPage.body).not.toContain('Резервная копия');
    expect(localPage.headers['content-security-policy']).toContain('style-src');
    expect(localPage.headers['cache-control']).toBe('no-store');
    expect(localStatus.statusCode).toBe(200);
    expect(styles.statusCode).toBe(200);
    expect(styles.headers['content-type']).toContain('text/css');
    expect(remotePage.statusCode).toBe(404);
  });

  it('hides production setup when the admin password is not configured', async () => {
    const app = createApp({ ...config, nodeEnv: 'production' });
    apps.add(app);
    registerTestSetup(app, { allowLocalBypass: false });

    const page = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/setup',
    });
    const session = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/admin/session',
    });
    const status = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/setup/status',
    });

    expect(page.statusCode).toBe(404);
    expect(session.statusCode).toBe(404);
    expect(status.statusCode).toBe(404);
  });

  it('protects production setup with the shared admin session', async () => {
    const app = createApp({ ...config, nodeEnv: 'production' });
    apps.add(app);
    registerTestSetup(app, {
      allowLocalBypass: false,
      password: 'correct-admin-password',
      telegramSource: 'environment',
      telegramRunning: true,
      vkSource: 'environment',
    });

    const page = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/setup',
    });
    const unauthorizedStatus = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/setup/status',
    });
    const unauthorizedMutation = await app.inject({
      method: 'POST',
      payload: { botToken: 'synthetic-token-that-must-not-appear' },
      remoteAddress: '192.0.2.10',
      url: '/api/setup/telegram/discover',
    });
    const login = await app.inject({
      headers: { host: 'example.test', origin: 'http://example.test' },
      method: 'POST',
      payload: { password: 'correct-admin-password' },
      remoteAddress: '192.0.2.10',
      url: '/api/admin/login',
    });
    const cookie = readSessionCookie(login.headers['set-cookie']);
    const status = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/setup/status',
    });
    const crossOriginMutation = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://attacker.test',
      },
      method: 'POST',
      payload: { botToken: 'synthetic-token-that-must-not-appear' },
      remoteAddress: '192.0.2.10',
      url: '/api/setup/telegram/discover',
    });
    const invalidMutation = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: {},
      remoteAddress: '192.0.2.10',
      url: '/api/setup/vk/connect',
    });
    const removedDeliveries = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/setup/deliveries',
    });
    const removedBackup = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: {},
      remoteAddress: '192.0.2.10',
      url: '/api/setup/backups',
    });

    expect(page.statusCode).toBe(200);
    expect(unauthorizedStatus.statusCode).toBe(401);
    expect(unauthorizedMutation.statusCode).toBe(401);
    expect(login.statusCode).toBe(200);
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({
      connected: true,
      locked: true,
      source: 'environment',
      vk: { connected: false, locked: true, source: 'environment' },
    });
    expect(status.body).not.toContain('correct-admin-password');
    expect(status.body).not.toContain('synthetic-token');
    expect(crossOriginMutation.statusCode).toBe(403);
    expect(invalidMutation.statusCode).toBe(400);
    expect(removedDeliveries.statusCode).toBe(404);
    expect(removedBackup.statusCode).toBe(404);
  });
});

function registerTestSetup(
  app: ReturnType<typeof createApp>,
  options: {
    allowLocalBypass: boolean;
    password?: string;
    telegramRunning?: boolean;
    telegramSource?: 'environment' | 'local' | 'none';
    vkSource?: 'environment' | 'local' | 'none';
  },
): void {
  const access = new PasswordSessionAccess(options.password, {
    createToken: () => 'synthetic-admin-session',
  });
  const routeAccess = createAdminRouteAccess(app, access, {
    allowLocalBypass: options.allowLocalBypass,
    secureCookies: true,
  });
  const telegram = new TelegramSetupController(
    {
      running: options.telegramRunning ?? false,
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
    },
    {
      load: () => Promise.resolve(undefined),
      save: () => Promise.resolve(),
    },
    options.telegramSource ?? 'none',
  );
  const vk = new VkSetupController(
    {
      running: false,
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
    },
    {
      load: () => Promise.resolve(undefined),
      save: () => Promise.resolve(),
    },
    options.vkSource ?? 'none',
  );
  registerAdminSessionRoutes(app, access, routeAccess, true);
  registerSetupRoutes(app, telegram, vk, routeAccess, { assets: setupAssets });
}

function readSessionCookie(setCookie: unknown): string {
  const header =
    typeof setCookie === 'string'
      ? setCookie
      : Array.isArray(setCookie) && typeof setCookie[0] === 'string'
        ? setCookie[0]
        : undefined;
  if (!header) {
    throw new Error('Expected a session cookie');
  }
  const [cookie] = header.split(';', 1);
  if (!cookie) {
    throw new Error('Expected a session cookie value');
  }
  return cookie;
}

function createMonitoringService(
  deliverySummary: () => { failed: number; pending: number },
): OperationsMonitoringService {
  return new OperationsMonitoringService({
    channelActivity: () => ({}),
    deliveryActivity: () => ({ lastCycleAt: new Date(), running: true }),
    deliverySummary,
    startedAt: new Date('2026-09-04T12:00:00.000Z'),
    telegramStatus: () => ({ connected: false, source: 'none' }),
    vkStatus: () => ({ connected: false, source: 'none' }),
  });
}
