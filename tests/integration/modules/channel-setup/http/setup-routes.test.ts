import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp } from '@/infrastructure/http/app.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';
import { VkSetupController } from '@/infrastructure/vk/vk-setup-controller.js';
import { registerSetupRoutes } from '@/modules/channel-setup/presentation/http/routes.js';

const config: RuntimeConfig = {
  closedRequestRetentionDays: 7,
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

describe('setup routes', () => {
  it('allows setup without a password only from loopback in development', async () => {
    const app = createApp(config);
    apps.add(app);
    registerTestSetup(app, { allowLocalBypass: true });

    const localStatus = await app.inject({
      method: 'GET',
      url: '/api/setup/status',
    });
    const remoteStatus = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/setup/status',
    });

    expect(localStatus.statusCode).toBe(200);
    expect(remoteStatus.statusCode).toBe(404);
  });

  it('hides production setup when the admin password is not configured', async () => {
    const app = createApp({ ...config, nodeEnv: 'production' });
    apps.add(app);
    registerTestSetup(app, { allowLocalBypass: false });

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
  registerSetupRoutes(app, telegram, vk, routeAccess);
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
