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

  it('disconnects local channels through protected same-origin routes', async () => {
    const app = createApp(config);
    apps.add(app);
    registerTestSetup(app, {
      allowLocalBypass: true,
      telegramRunning: true,
      telegramSource: 'local',
      vkSource: 'local',
    });

    const vk = await app.inject({
      headers: { host: 'localhost', origin: 'http://localhost' },
      method: 'DELETE',
      url: '/api/setup/vk',
    });
    const telegram = await app.inject({
      headers: { host: 'localhost', origin: 'http://localhost' },
      method: 'DELETE',
      url: '/api/setup/telegram',
    });

    expect(vk.statusCode).toBe(200);
    expect(vk.json()).toEqual({ connected: false });
    expect(telegram.statusCode).toBe(200);
    expect(telegram.json()).toEqual({ connected: false });

    const status = await app.inject({
      method: 'GET',
      url: '/api/setup/status',
    });
    expect(status.json()).toEqual({
      connected: false,
      locked: false,
      source: 'none',
      vk: { connected: false, locked: false, source: 'none' },
    });
  });

  it('reports connect, disconnect, and reconnect through the status API', async () => {
    const app = createApp(config);
    apps.add(app);
    registerTestSetup(app, { allowLocalBypass: true });
    const headers = { host: 'localhost', origin: 'http://localhost' };

    for (const suffix of ['first', 'replacement']) {
      const telegram = await app.inject({
        headers,
        method: 'POST',
        payload: {
          botToken: `synthetic-telegram-token-${suffix}`,
          operatorChatId: -1001,
        },
        url: '/api/setup/telegram/connect',
      });
      const vk = await app.inject({
        headers,
        method: 'POST',
        payload: {
          accessToken: `synthetic-vk-access-token-${suffix}`,
          community: 'https://vk.com/test',
        },
        url: '/api/setup/vk/connect',
      });
      const connectedStatus = await app.inject({
        method: 'GET',
        url: '/api/setup/status',
      });

      expect(telegram.statusCode).toBe(200);
      expect(vk.statusCode).toBe(200);
      expect(connectedStatus.json()).toEqual({
        connected: true,
        locked: true,
        source: 'local',
        vk: { connected: true, locked: true, source: 'local' },
      });

      if (suffix === 'first') {
        await app.inject({ headers, method: 'DELETE', url: '/api/setup/vk' });
        await app.inject({
          headers,
          method: 'DELETE',
          url: '/api/setup/telegram',
        });
        const disconnectedStatus = await app.inject({
          method: 'GET',
          url: '/api/setup/status',
        });
        expect(disconnectedStatus.json()).toEqual({
          connected: false,
          locked: false,
          source: 'none',
          vk: { connected: false, locked: false, source: 'none' },
        });
      }
    }
  });

  it('rejects disconnect for environment-managed channels in the API', async () => {
    const app = createApp(config);
    apps.add(app);
    registerTestSetup(app, {
      allowLocalBypass: true,
      telegramRunning: true,
      telegramSource: 'environment',
      vkRunning: true,
      vkSource: 'environment',
    });

    const telegram = await app.inject({
      headers: { host: 'localhost', origin: 'http://localhost' },
      method: 'DELETE',
      url: '/api/setup/telegram',
    });
    const vk = await app.inject({
      headers: { host: 'localhost', origin: 'http://localhost' },
      method: 'DELETE',
      url: '/api/setup/vk',
    });

    expect(telegram.statusCode).toBe(409);
    expect(telegram.json()).toEqual({ message: 'Управляется на сервере.' });
    expect(vk.statusCode).toBe(409);
    expect(vk.json()).toEqual({ message: 'Управляется на сервере.' });
  });

  it('requires VK to be disconnected before Telegram', async () => {
    const app = createApp(config);
    apps.add(app);
    registerTestSetup(app, {
      allowLocalBypass: true,
      telegramRunning: true,
      telegramSource: 'local',
      vkSource: 'local',
    });

    const result = await app.inject({
      headers: { host: 'localhost', origin: 'http://localhost' },
      method: 'DELETE',
      url: '/api/setup/telegram',
    });

    expect(result.statusCode).toBe(409);
    expect(result.json()).toEqual({ message: 'Сначала отключите VK.' });
  });

  it('requires Telegram to be connected before VK in the API', async () => {
    const app = createApp(config);
    apps.add(app);
    registerTestSetup(app, {
      allowLocalBypass: true,
      telegramSource: 'none',
      vkSource: 'none',
    });

    const result = await app.inject({
      headers: { host: 'localhost', origin: 'http://localhost' },
      method: 'POST',
      payload: {
        accessToken: 'synthetic-vk-community-access-token',
        community: 'https://vk.com/test',
      },
      url: '/api/setup/vk/connect',
    });

    expect(result.statusCode).toBe(409);
    expect(result.json()).toEqual({ message: 'Сначала подключите Telegram.' });
  });

  it('rejects cross-origin disconnect requests', async () => {
    const app = createApp(config);
    apps.add(app);
    registerTestSetup(app, {
      allowLocalBypass: true,
      telegramRunning: true,
      telegramSource: 'local',
    });

    const result = await app.inject({
      headers: { host: 'localhost', origin: 'http://attacker.test' },
      method: 'DELETE',
      url: '/api/setup/telegram',
    });

    expect(result.statusCode).toBe(403);
  });
});

function registerTestSetup(
  app: ReturnType<typeof createApp>,
  options: {
    allowLocalBypass: boolean;
    password?: string;
    telegramRunning?: boolean;
    telegramSource?: 'environment' | 'local' | 'none';
    vkRunning?: boolean;
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
  let telegramRunning = options.telegramRunning ?? false;
  const telegram = new TelegramSetupController(
    {
      get running() {
        return telegramRunning;
      },
      start: () => {
        telegramRunning = true;
        return Promise.resolve();
      },
      stop: () => {
        telegramRunning = false;
        return Promise.resolve();
      },
    },
    {
      clear: () => Promise.resolve(),
      load: () => Promise.resolve(undefined),
      save: () => Promise.resolve(),
    },
    options.telegramSource ?? 'none',
  );
  let vkRunning = options.vkRunning ?? false;
  const vk = new VkSetupController(
    {
      get running() {
        return vkRunning;
      },
      start: () => {
        vkRunning = true;
        return Promise.resolve();
      },
      stop: () => {
        vkRunning = false;
        return Promise.resolve();
      },
    },
    {
      clear: () => Promise.resolve(),
      load: () => Promise.resolve(undefined),
      save: () => Promise.resolve(),
    },
    options.vkSource ?? 'none',
    () => ({
      getLongPollServer: () => Promise.resolve({}),
      resolveCommunity: () => Promise.resolve(42),
    }),
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
