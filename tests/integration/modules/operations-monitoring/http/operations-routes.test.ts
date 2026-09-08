import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp } from '@/infrastructure/http/app.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import { registerOperationsRoutes } from '@/modules/operations-monitoring/presentation/http/routes.js';
import type { ServiceControlStore } from '@/modules/service-control/application/ports/service-control-store.js';
import { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';
import { createDefaultServiceControlState } from '@/modules/service-control/model/service-control-state.js';

const config: RuntimeConfig = {
  closedRequestRetentionDays: 7,
  databasePath: './data/test.sqlite',
  host: '0.0.0.0',
  logLevel: 'silent',
  nodeEnv: 'production',
  port: 3000,
};

const apps = new Set<ReturnType<typeof createApp>>();
const operationsAssets = {
  html: '<!doctype html><title>Состояние сервиса</title>',
  script: 'globalThis.operationsApp = true;',
  styles: ':root { color: black; }',
};

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('operations monitoring routes', () => {
  it('returns status only through the admin session', async () => {
    const app = createApp(config);
    const retriedDeliveries: string[] = [];
    const resolvedDeliveries: string[] = [];
    apps.add(app);
    const access = new PasswordSessionAccess('correct-admin-password', {
      createToken: () => 'synthetic-admin-session',
    });
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: false,
      secureCookies: true,
    });
    registerAdminSessionRoutes(app, access, routeAccess, true);
    registerOperationsRoutes(
      app,
      createMonitoringService(),
      routeAccess,
      { assets: operationsAssets },
      createServiceControl(),
      {
        confirmUnknownDeliveryNotReceived: (deliveryId) => {
          resolvedDeliveries.push(`not_received:${deliveryId}`);
          return true;
        },
        confirmUnknownDeliveryReceived: (deliveryId) => {
          resolvedDeliveries.push(`received:${deliveryId}`);
          return true;
        },
        retryFailedDelivery: (deliveryId) => {
          retriedDeliveries.push(deliveryId);
          return true;
        },
      },
      undefined,
      {
        getUsageEventCounts: () => ({
          delivery_failure: 2,
          first_reply: 7,
          information_section: 11,
          new_request: 8,
          web_takeover: 1,
        }),
      },
    );

    const unauthorized = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/ops/status',
    });
    const page = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/ops',
    });
    const pageWithQuery = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/ops?test=1',
    });
    const crossOrigin = await app.inject({
      headers: {
        host: 'example.test',
        origin: 'https://attacker.test',
      },
      method: 'POST',
      payload: { password: 'correct-admin-password' },
      remoteAddress: '192.0.2.10',
      url: '/api/admin/login',
    });
    const login = await app.inject({
      headers: {
        host: 'example.test',
        origin: 'http://example.test',
      },
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
      url: '/api/ops/status',
    });
    const usageMetrics = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/ops/usage-metrics',
    });
    const serviceControl = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/ops/service-control',
    });
    const pauseDelivery = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      remoteAddress: '192.0.2.10',
      url: '/api/ops/service-control/delivery/pause',
    });
    const retry = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      remoteAddress: '192.0.2.10',
      url: '/api/ops/deliveries/delivery-1/retry',
    });
    const resolveDelivery = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: { resolution: 'received' },
      remoteAddress: '192.0.2.10',
      url: '/api/ops/deliveries/delivery-unknown/resolve',
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(pageWithQuery.headers['cache-control']).toBe('no-store');
    expect(pageWithQuery.headers['x-frame-options']).toBe('DENY');
    expect(crossOrigin.statusCode).toBe(403);
    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toContain(
      '__Host-mh-admin-session=synthetic-admin-session',
    );
    expect(status.statusCode).toBe(200);
    expect(usageMetrics.statusCode).toBe(200);
    expect(usageMetrics.json()).toMatchObject({
      events: {
        delivery_failure: 2,
        first_reply: 7,
        information_section: 11,
        new_request: 8,
        web_takeover: 1,
      },
      periodDays: 30,
    });
    expect(serviceControl.statusCode).toBe(200);
    expect(pauseDelivery.statusCode).toBe(200);
    expect(pauseDelivery.json()).toMatchObject({
      channels: {
        telegram: { mode: 'active' },
        vk: { mode: 'active' },
      },
      delivery: { mode: 'paused' },
    });
    expect(retry.statusCode).toBe(200);
    expect(retriedDeliveries).toEqual(['delivery-1']);
    expect(resolveDelivery.statusCode).toBe(200);
    expect(resolvedDeliveries).toEqual(['received:delivery-unknown']);
    expect(serviceControl.json()).toMatchObject({
      channels: {
        telegram: { mode: 'active' },
        vk: { mode: 'active' },
      },
    });
    expect(status.json()).toMatchObject({
      channels: {
        telegram: { configured: true, running: true },
        vk: { configured: true, running: false },
      },
      deliveries: { failed: 1, pending: 2 },
      state: 'attention',
    });
    expect(status.headers['cache-control']).toBe('no-store');
  });

  it('hides remote monitoring when its password is not configured', async () => {
    const app = createApp(config);
    apps.add(app);
    const access = new PasswordSessionAccess(undefined);
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: false,
      secureCookies: true,
    });
    registerAdminSessionRoutes(app, access, routeAccess, true);
    registerOperationsRoutes(app, createMonitoringService(), routeAccess, {
      assets: operationsAssets,
    });

    const response = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/ops/status',
    });

    expect(response.statusCode).toBe(404);
  });

  it('keeps local development monitoring available without a password', async () => {
    const app = createApp(config);
    apps.add(app);
    const access = new PasswordSessionAccess(undefined);
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: true,
      secureCookies: false,
    });
    registerAdminSessionRoutes(app, access, routeAccess, false);
    registerOperationsRoutes(app, createMonitoringService(), routeAccess, {
      assets: operationsAssets,
    });

    const response = await app.inject({
      method: 'GET',
      remoteAddress: '127.0.0.1',
      url: '/api/ops/status',
    });

    expect(response.statusCode).toBe(200);
  });
});

function createServiceControl(): ServiceControlService {
  const store: ServiceControlStore = {
    load: () => Promise.resolve(undefined),
    save: () => Promise.resolve(),
  };
  return new ServiceControlService(createDefaultServiceControlState(), store);
}

function createMonitoringService(): OperationsMonitoringService {
  return new OperationsMonitoringService({
    channelActivity: () => ({}),
    clock: () => new Date('2026-09-04T12:01:00.000Z'),
    deliveryActivity: () => ({
      lastCycleAt: new Date('2026-09-04T12:00:59.000Z'),
      running: true,
    }),
    deliverySummary: () => ({ failed: 1, pending: 2 }),
    startedAt: new Date('2026-09-04T12:00:00.000Z'),
    telegramStatus: () => ({ connected: true, source: 'environment' }),
    vkStatus: () => ({ connected: false, source: 'local' }),
  });
}

function readSessionCookie(setCookie: unknown): string {
  let header: string | undefined;
  if (typeof setCookie === 'string') {
    header = setCookie;
  } else if (Array.isArray(setCookie)) {
    const firstHeader: unknown = setCookie[0];
    if (typeof firstHeader === 'string') {
      header = firstHeader;
    }
  }
  if (!header) {
    throw new Error('Expected a session cookie');
  }
  const [cookie] = header.split(';', 1);
  if (!cookie) {
    throw new Error('Expected a session cookie value');
  }
  return cookie;
}
