import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { createApp } from '@/infrastructure/http/app.js';
import { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import type { ContentSettingsStore } from '@/modules/content-management/application/ports/content-settings-store.js';
import { registerManagementRoutes } from '@/modules/content-management/presentation/http/routes.js';
import { ContentManagementAccess } from '@/modules/content-management/security/content-management-access.js';
import type { ServiceControlStore } from '@/modules/service-control/application/ports/service-control-store.js';
import { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';
import { createDefaultServiceControlState } from '@/modules/service-control/model/service-control-state.js';

const config: RuntimeConfig = {
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
    registerManagementRoutes(
      app,
      new ContentManagementService(
        new ClientInformationCatalog(),
        createContentStore(),
      ),
      new ContentManagementAccess(undefined),
      {
        allowLocalBypass: true,
        assets: {
          html: '<!doctype html>',
          script: '',
          styles: '',
        },
        secureCookies: false,
      },
      serviceControl,
    );

    const paused = await app.inject({
      method: 'POST',
      payload: {},
      url: '/api/manage/service-control/telegram/pause',
    });
    const resumed = await app.inject({
      method: 'POST',
      payload: {},
      url: '/api/manage/service-control/telegram/resume',
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
  });
});

function createContentStore(): ContentSettingsStore {
  return {
    load: () => Promise.resolve(undefined),
    loadHistory: () => Promise.resolve([]),
    restore: () => Promise.reject(new Error('not available')),
    save: () => Promise.resolve(),
  };
}
