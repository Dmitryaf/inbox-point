import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { createApp } from '@/infrastructure/http/app.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import type { ContentSettingsStore } from '@/modules/content-management/application/ports/content-settings-store.js';
import { registerManagementRoutes } from '@/modules/content-management/presentation/http/routes.js';

const config: RuntimeConfig = {
  closedRequestRetentionDays: 7,
  databasePath: './data/test.sqlite',
  host: '127.0.0.1',
  logLevel: 'silent',
  nodeEnv: 'development',
  port: 3000,
};

const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('managed content read errors', () => {
  it('does not expose storage errors to the administrator', async () => {
    const app = createApp(config);
    apps.add(app);
    const internalMessage = 'The local content settings are invalid';
    const store: ContentSettingsStore = {
      load: () => Promise.reject(new Error(internalMessage)),
      loadHistory: () => Promise.reject(new Error(internalMessage)),
      restore: () => Promise.reject(new Error('not used')),
      save: () => Promise.reject(new Error('not used')),
    };
    const access = new PasswordSessionAccess(undefined);
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: true,
      secureCookies: false,
    });
    registerManagementRoutes(
      app,
      new ContentManagementService(new ClientInformationCatalog(), store),
      routeAccess,
    );

    const history = await app.inject({
      method: 'GET',
      url: '/api/manage/content/history',
    });

    expect(history.statusCode).toBe(500);
    expect(history.json()).toEqual({
      message: 'Не удалось загрузить историю изменений. Попробуйте ещё раз.',
    });
    expect(history.body).not.toContain(internalMessage);
  });
});
