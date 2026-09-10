import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { createApp } from '@/infrastructure/http/app.js';
import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import { registerReadinessRoute } from '@/modules/operations-monitoring/presentation/http/readiness-route.js';

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

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('HTTP service status', () => {
  it('includes the operational instance label in application logs', () => {
    const app = createApp({ ...config, instanceId: 'instance-a' });
    apps.add(app);

    const logger = app.log as typeof app.log & {
      bindings(): Record<string, unknown>;
    };
    expect(logger.bindings()).toMatchObject({ instanceId: 'instance-a' });
  });

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

  it('fails readiness when the delivery worker stopped with an empty queue', async () => {
    const app = createApp(config);
    apps.add(app);
    registerReadinessRoute(
      app,
      new OperationsMonitoringService({
        channelActivity: () => ({}),
        deliveryActivity: () => ({ running: false }),
        deliverySummary: () => ({ failed: 0, pending: 0 }),
        startedAt: new Date('2026-09-04T12:00:00.000Z'),
        telegramStatus: () => ({ connected: false, source: 'none' }),
        vkStatus: () => ({ connected: false, source: 'none' }),
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
});

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
