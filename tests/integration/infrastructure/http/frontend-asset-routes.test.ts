import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { createApp } from '@/infrastructure/http/app.js';
import { registerFrontendRoutes } from '@/infrastructure/http/frontend-asset-routes.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';

const config: RuntimeConfig = {
  closedRequestRetentionDays: 7,
  databasePath: './data/test.sqlite',
  host: '127.0.0.1',
  instanceId: 'default',
  logLevel: 'silent',
  nodeEnv: 'test',
  port: 3000,
};
const apps = new Set<ReturnType<typeof createApp>>();
const assets = {
  html: '<!doctype html><div id="app"></div><script src="/app.js"></script>',
  icon: '<svg>icon</svg>',
  script: 'globalThis.app = true;',
  styles: ':root { color: black; }',
};

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('shared frontend routes', () => {
  it('serves one entry and one asset set for every browser route', async () => {
    const app = createApp(config);
    apps.add(app);
    const routeAccess = createAdminRouteAccess(
      app,
      new PasswordSessionAccess('synthetic-password'),
      { allowLocalBypass: false, secureCookies: true },
    );
    registerFrontendRoutes(app, routeAccess, assets);

    for (const path of ['/login', '/manage', '/setup', '/ops', '/unknown']) {
      const response = await app.inject({ method: 'GET', url: path });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(assets.html);
      expect(response.headers['content-security-policy']).toContain(
        "default-src 'none'",
      );
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-frame-options']).toBe('DENY');
    }

    const script = await app.inject({ method: 'GET', url: '/app.js' });
    const styles = await app.inject({ method: 'GET', url: '/style.css' });
    const icon = await app.inject({ method: 'GET', url: '/favicon.svg' });
    const unknownApi = await app.inject({ method: 'GET', url: '/api/unknown' });

    expect(script.body).toBe(assets.script);
    expect(styles.body).toBe(assets.styles);
    expect(icon.body).toBe(assets.icon);
    expect(unknownApi.statusCode).toBe(404);
    expect(unknownApi.json()).toEqual({ message: 'Not found' });
  });
});
