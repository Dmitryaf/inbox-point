import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp } from '@/infrastructure/http/app.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';

const config: RuntimeConfig = {
  closedRequestRetentionDays: 7,
  databasePath: './data/test.sqlite',
  host: '0.0.0.0',
  instanceId: 'default',
  logLevel: 'silent',
  nodeEnv: 'production',
  port: 3000,
};

const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('admin session routes', () => {
  it('reports local passwordless access as bypass without a fake logout', async () => {
    const app = createApp(config);
    apps.add(app);
    const access = new PasswordSessionAccess(undefined);
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: true,
      secureCookies: false,
    });
    registerAdminSessionRoutes(app, access, routeAccess, false);

    const session = await app.inject({
      method: 'GET',
      url: '/api/admin/session',
    });
    const logout = await app.inject({
      method: 'POST',
      payload: {},
      url: '/api/admin/logout',
    });
    const revoke = await app.inject({
      method: 'POST',
      payload: {},
      url: '/api/admin/sessions/revoke-all',
    });

    expect(session.json()).toEqual({ authenticated: true, mode: 'bypass' });
    expect(logout.json()).toEqual({ authenticated: true, mode: 'bypass' });
    expect(revoke.json()).toEqual({ authenticated: true, mode: 'bypass' });
  });

  it('requires a real session in development when a password is configured', async () => {
    const app = createApp(config);
    apps.add(app);
    const access = new PasswordSessionAccess('correct-admin-password', {
      createToken: () => 'development-session',
    });
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: true,
      secureCookies: false,
    });
    registerAdminSessionRoutes(app, access, routeAccess, false);

    const beforeLogin = await app.inject({
      method: 'GET',
      url: '/api/admin/session',
    });
    const login = await app.inject({
      method: 'POST',
      payload: { password: 'correct-admin-password' },
      url: '/api/admin/login',
    });
    const cookie = readSessionCookie(login.headers['set-cookie']);
    const authenticated = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: '/api/admin/session',
    });
    const logout = await app.inject({
      headers: { cookie },
      method: 'POST',
      payload: {},
      url: '/api/admin/logout',
    });

    expect(beforeLogin.json()).toEqual({
      authenticated: false,
      mode: 'password',
    });
    expect(login.json()).toEqual({ authenticated: true, mode: 'password' });
    expect(authenticated.json()).toEqual({
      authenticated: true,
      mode: 'password',
    });
    expect(logout.json()).toEqual({ authenticated: false, mode: 'password' });
  });

  it('shares login, expiry and logout across management and operations', async () => {
    const app = createApp(config);
    apps.add(app);
    let now = 1_000;
    let tokenNumber = 0;
    const access = new PasswordSessionAccess('correct-admin-password', {
      createToken: () => `admin-session-${(tokenNumber += 1)}`,
      now: () => now,
    });
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: false,
      secureCookies: true,
    });
    registerAdminSessionRoutes(app, access, routeAccess, true);
    app.get(
      '/api/manage/probe',
      { preHandler: routeAccess.requireAuthorization },
      () => ({ surface: 'manage' }),
    );
    app.get(
      '/api/ops/probe',
      { preHandler: routeAccess.requireAuthorization },
      () => ({ surface: 'ops' }),
    );

    const wrongScheme = await app.inject({
      headers: {
        host: 'example.test',
        origin: 'http://example.test',
        'x-forwarded-for': '192.0.2.10',
        'x-forwarded-proto': 'https',
      },
      method: 'POST',
      payload: { password: 'correct-admin-password' },
      remoteAddress: '127.0.0.1',
      url: '/api/admin/login',
    });
    const login = await app.inject({
      headers: {
        host: 'example.test',
        origin: 'https://example.test',
        'x-forwarded-for': '192.0.2.10',
        'x-forwarded-proto': 'https',
      },
      method: 'POST',
      payload: { password: 'correct-admin-password' },
      remoteAddress: '127.0.0.1',
      url: '/api/admin/login',
    });
    const firstCookie = readSessionCookie(login.headers['set-cookie']);

    expect(wrongScheme.statusCode).toBe(403);
    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toContain(
      '__Host-inbox-point-admin-session=admin-session-1',
    );
    expect(login.headers['set-cookie']).toContain('Max-Age=43200');
    await expectSurfaceAccess(app, firstCookie, 200);

    now += 12 * 60 * 60 * 1_000 + 1;
    await expectSurfaceAccess(app, firstCookie, 401);

    const secondLogin = await app.inject({
      headers: {
        host: 'example.test',
        origin: 'https://example.test',
        'x-forwarded-for': '192.0.2.10',
        'x-forwarded-proto': 'https',
      },
      method: 'POST',
      payload: {
        password: 'correct-admin-password',
        rememberDevice: true,
      },
      remoteAddress: '127.0.0.1',
      url: '/api/admin/login',
    });
    const secondCookie = readSessionCookie(secondLogin.headers['set-cookie']);
    expect(secondLogin.headers['set-cookie']).toContain('Max-Age=2592000');
    expect(secondLogin.headers['set-cookie']).toContain('HttpOnly');
    expect(secondLogin.headers['set-cookie']).toContain('SameSite=Strict');
    expect(secondLogin.headers['set-cookie']).toContain('Secure');
    const logout = await app.inject({
      headers: {
        cookie: secondCookie,
        host: 'example.test',
        origin: 'https://example.test',
        'x-forwarded-for': '192.0.2.10',
        'x-forwarded-proto': 'https',
      },
      method: 'POST',
      payload: {},
      remoteAddress: '127.0.0.1',
      url: '/api/admin/logout',
    });

    expect(logout.statusCode).toBe(200);
    expect(logout.headers['set-cookie']).toContain(
      '__Host-inbox-point-admin-session=; Path=/; Max-Age=0',
    );
    await expectSurfaceAccess(app, secondCookie, 401);
    await expect(
      app.inject({ method: 'GET', url: '/api/manage/session' }),
    ).resolves.toMatchObject({ statusCode: 404 });
    await expect(
      app.inject({ method: 'GET', url: '/api/ops/session' }),
    ).resolves.toMatchObject({ statusCode: 404 });
  });

  it('accepts a same-origin mutation through a configured Docker bridge gateway', async () => {
    const app = createApp({
      ...config,
      trustedProxies: ['172.20.0.1/32'],
    });
    apps.add(app);
    const access = new PasswordSessionAccess('correct-admin-password', {
      createToken: () => 'production-session',
    });
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: false,
      secureCookies: true,
    });
    registerAdminSessionRoutes(app, access, routeAccess, true);

    const login = await app.inject({
      headers: {
        host: 'app:3000',
        origin: 'https://inboxpoint.ru',
        'x-forwarded-for': '192.0.2.10',
        'x-forwarded-host': 'inboxpoint.ru',
        'x-forwarded-proto': 'https',
      },
      method: 'POST',
      payload: { password: 'correct-admin-password' },
      remoteAddress: '172.20.0.1',
      url: '/api/admin/login',
    });

    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toContain(
      '__Host-inbox-point-admin-session=production-session',
    );
  });

  it('revokes sessions on every device and clears the current cookie', async () => {
    const app = createApp(config);
    apps.add(app);
    const tokens = ['first-admin-session', 'second-admin-session'];
    const access = new PasswordSessionAccess('correct-admin-password', {
      createToken: () => tokens.shift()!,
    });
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: false,
      secureCookies: true,
    });
    registerAdminSessionRoutes(app, access, routeAccess, true);
    app.get(
      '/api/manage/probe',
      { preHandler: routeAccess.requireAuthorization },
      () => ({ ok: true }),
    );

    const firstLogin = await app.inject({
      method: 'POST',
      payload: { password: 'correct-admin-password' },
      url: '/api/admin/login',
    });
    const secondLogin = await app.inject({
      method: 'POST',
      payload: {
        password: 'correct-admin-password',
        rememberDevice: true,
      },
      url: '/api/admin/login',
    });
    const firstCookie = readSessionCookie(firstLogin.headers['set-cookie']);
    const secondCookie = readSessionCookie(secondLogin.headers['set-cookie']);

    const crossOriginRevoke = await app.inject({
      headers: {
        cookie: secondCookie,
        host: 'example.test',
        origin: 'https://other.test',
      },
      method: 'POST',
      payload: {},
      url: '/api/admin/sessions/revoke-all',
    });
    expect(crossOriginRevoke.statusCode).toBe(403);

    const revoke = await app.inject({
      headers: { cookie: secondCookie },
      method: 'POST',
      payload: {},
      url: '/api/admin/sessions/revoke-all',
    });

    expect(revoke.statusCode).toBe(200);
    expect(revoke.json()).toEqual({
      authenticated: false,
      mode: 'password',
    });
    expect(revoke.headers['set-cookie']).toContain(
      '__Host-inbox-point-admin-session=; Path=/; Max-Age=0',
    );
    for (const cookie of [firstCookie, secondCookie]) {
      await expect(
        app.inject({
          headers: { cookie },
          method: 'GET',
          url: '/api/manage/probe',
        }),
      ).resolves.toMatchObject({ statusCode: 401 });
    }
  });

  it('keeps login rate limiting for remembered login attempts', async () => {
    const app = createApp(config);
    apps.add(app);
    const access = new PasswordSessionAccess('correct-admin-password', {
      now: () => 1_000,
    });
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: false,
      secureCookies: true,
    });
    registerAdminSessionRoutes(app, access, routeAccess, true);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        payload: { password: 'wrong-password', rememberDevice: true },
        remoteAddress: '192.0.2.10',
        url: '/api/admin/login',
      });
      expect(response.statusCode).toBe(401);
    }
    const blocked = await app.inject({
      method: 'POST',
      payload: { password: 'wrong-password', rememberDevice: true },
      remoteAddress: '192.0.2.10',
      url: '/api/admin/login',
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBe('900');
  });
});

async function expectSurfaceAccess(
  app: ReturnType<typeof createApp>,
  cookie: string,
  statusCode: number,
): Promise<void> {
  const management = await app.inject({
    headers: { cookie },
    method: 'GET',
    remoteAddress: '192.0.2.10',
    url: '/api/manage/probe',
  });
  const operations = await app.inject({
    headers: { cookie },
    method: 'GET',
    remoteAddress: '192.0.2.10',
    url: '/api/ops/probe',
  });

  expect(management.statusCode).toBe(statusCode);
  expect(operations.statusCode).toBe(statusCode);
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
