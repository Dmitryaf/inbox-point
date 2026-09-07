import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { createApp } from '@/infrastructure/http/app.js';
import type { ServiceControlStore } from '@/modules/service-control/application/ports/service-control-store.js';
import { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';
import { createDefaultServiceControlState } from '@/modules/service-control/model/service-control-state.js';
import { registerServiceControlRoutes } from '@/modules/service-control/presentation/http/service-control-routes.js';

const config: RuntimeConfig = {
  closedRequestRetentionDays: 7,
  databasePath: './data/test.sqlite',
  host: '0.0.0.0',
  logLevel: 'silent',
  nodeEnv: 'development',
  port: 3000,
};

const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('service control routes', () => {
  it('pauses and resumes a channel', async () => {
    const app = createApp(config);
    apps.add(app);
    const serviceControlStore: ServiceControlStore = {
      load: () => Promise.resolve(undefined),
      save: () => Promise.resolve(),
    };
    const serviceControl = new ServiceControlService(
      createDefaultServiceControlState(),
      serviceControlStore,
      () => new Date('2026-09-05T10:00:00.000Z'),
    );
    registerServiceControlRoutes(
      app,
      serviceControl,
      {
        requireAuthorization: () => Promise.resolve(),
        requireSameOrigin: () => Promise.resolve(),
      },
      '/api/ops/service-control',
      true,
    );

    const paused = await app.inject({
      method: 'POST',
      payload: {},
      url: '/api/ops/service-control/telegram/pause',
    });
    const resumed = await app.inject({
      method: 'POST',
      payload: {},
      url: '/api/ops/service-control/telegram/resume',
    });
    const deliveryControl = await app.inject({
      method: 'POST',
      payload: {},
      url: '/api/ops/service-control/delivery/pause',
    });
    const managementControl = await app.inject({
      method: 'GET',
      url: '/api/manage/service-control',
    });

    expect(paused.statusCode).toBe(200);
    expect(paused.json()).toMatchObject({
      channels: {
        telegram: {
          changedAt: '2026-09-05T10:00:00.000Z',
          mode: 'paused',
        },
      },
    });
    expect(resumed.json()).toMatchObject({
      channels: { telegram: { mode: 'active' } },
    });
    expect(deliveryControl.statusCode).toBe(200);
    expect(managementControl.statusCode).toBe(404);
  });
});
