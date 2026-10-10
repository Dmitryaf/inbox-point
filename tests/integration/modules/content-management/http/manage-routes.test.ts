import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp } from '@/infrastructure/http/app.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import type {
  ContentChange,
  ContentSettingsStore,
} from '@/modules/content-management/application/ports/content-settings-store.js';
import { registerManagementRoutes } from '@/modules/content-management/presentation/http/routes.js';

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

describe('managed content routes', () => {
  it('requires a bounded authenticated session for remote content changes', async () => {
    const app = createApp(config);
    apps.add(app);
    const catalog = new ClientInformationCatalog();
    const history: ContentChange[] = [];
    const restored: number[] = [];
    const saved: unknown[] = [];
    const store: ContentSettingsStore = {
      load: () => Promise.resolve(undefined),
      loadHistoricalMenuActions: () => Promise.resolve([]),
      loadRevision: (revision) =>
        Promise.resolve(
          revision === 1
            ? {
                legacySchedule: 'Legacy schedule',
                address: 'Hidden address',
                visibleSections: [],
              }
            : undefined,
        ),
      loadHistory: () => Promise.resolve(history),
      restore: (revision) => {
        restored.push(revision);
        return Promise.resolve({
          faq: [
            {
              answer: 'Напишите оператору.',
              question: 'Как записаться?',
            },
          ],
          schedule: [{ dayTime: 'Понедельник', title: 'Восстановлено' }],
        });
      },
      save: (content) => {
        saved.push(content);
        history.unshift({
          changedAt: '2026-09-01T12:00:00.000Z',
          revision: 1,
          sections: ['faq'],
        });
        return Promise.resolve();
      },
    };
    const access = new PasswordSessionAccess('correct-password', {
      createToken: () => 'synthetic-session-token',
    });
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: false,
      secureCookies: true,
    });
    registerAdminSessionRoutes(app, access, routeAccess, true);
    registerManagementRoutes(
      app,
      new ContentManagementService(catalog, store),
      routeAccess,
    );

    const unauthorized = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content',
    });
    const crossOrigin = await app.inject({
      headers: {
        host: 'example.test',
        origin: 'https://attacker.test',
      },
      method: 'POST',
      payload: { password: 'correct-password' },
      remoteAddress: '192.0.2.10',
      url: '/api/admin/login',
    });
    const wrong = await app.inject({
      headers: {
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: { password: 'wrong-password' },
      remoteAddress: '192.0.2.10',
      url: '/api/admin/login',
    });
    const login = await app.inject({
      headers: {
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: { password: 'correct-password' },
      remoteAddress: '192.0.2.10',
      url: '/api/admin/login',
    });
    const setCookie = login.headers['set-cookie'];
    const sessionHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!sessionHeader) {
      throw new Error('Expected a session cookie');
    }
    const [cookie] = sessionHeader.split(';', 1);
    if (!cookie) {
      throw new Error('Expected a session cookie value');
    }
    const loaded = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content',
    });
    const loadedVersion = loaded.json<{ version: string }>().version;
    const preview = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content/history/1',
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json<{ content: unknown }>().content).toMatchObject({
      schedule: 'Legacy schedule',
      scheduleItems: [],
      address: 'Hidden address',
      visibleSections: [],
    });
    expect(saved).toHaveLength(0);
    expect(restored).toHaveLength(0);
    for (const [revision, statusCode] of [
      ['999', 404],
      ['0', 400],
      ['abc', 400],
      ['1.5', 400],
    ] as const) {
      expect(
        (
          await app.inject({
            headers: { cookie },
            method: 'GET',
            remoteAddress: '192.0.2.10',
            url: `/api/manage/content/history/${revision}`,
          })
        ).statusCode,
      ).toBe(statusCode);
    }
    expect(
      (
        await app.inject({
          method: 'GET',
          remoteAddress: '192.0.2.10',
          url: '/api/manage/content/history/1',
        })
      ).statusCode,
    ).toBe(401);
    const save = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: {
        content: {
          address: '',
          customSections: [],
          faq: [
            {
              answer: 'Напишите оператору.',
              question: 'Как записаться?',
            },
          ],
          prices: '',
          schedule: '',
          scheduleItems: [],
          directions: [{ id: 'dance', name: ' Бачата ' }],
          groups: [
            {
              id: 'group',
              directionId: 'dance',
              name: ' Начинающие ',
              meetings: [' Вт / Чт, 19:00 '],
              description: ' Для начинающих. ',
              enrollmentOpen: false,
              applicationQuestion: '',
            },
          ],
        },
        version: loadedVersion,
      },
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content',
    });
    const conflict = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: {
        content: {
          address: '',
          customSections: [],
          faq: [],
          prices: '',
          schedule: '',
          scheduleItems: [],
        },
        version: loadedVersion,
      },
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content',
    });
    const invalidPartialSchedule = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: {
        content: {
          address: '',
          customSections: [],
          faq: [],
          prices: '',
          schedule: '',
          scheduleItems: [],
          directions: [{ id: 'dance', name: 'Бачата' }],
          groups: [
            {
              id: 'group',
              directionId: 'dance',
              name: 'Начинающие',
              meetings: [],
              description: '',
              enrollmentOpen: false,
              applicationQuestion: '',
            },
          ],
        },
        version: save.json<{ version: string }>().version,
      },
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content',
    });
    const oversizedSchedule = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: {
        content: {
          address: '',
          customSections: [],
          faq: [],
          prices: '',
          schedule: '',
          scheduleItems: [],
          directions: [{ id: 'dance', name: 'Бачата' }],
          groups: [
            {
              id: 'group',
              directionId: 'dance',
              name: 'Начинающие',
              meetings: ['Вт'],
              description: 'x'.repeat(1001),
              enrollmentOpen: false,
              applicationQuestion: '',
            },
          ],
        },
        version: save.json<{ version: string }>().version,
      },
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content',
    });
    const readHistory = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content/history',
    });
    const restore = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: {
        revision: 7,
        version: save.json<{ version: string }>().version,
      },
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content/restore',
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(crossOrigin.statusCode).toBe(403);
    expect(wrong.statusCode).toBe(401);
    expect(wrong.body).not.toContain('correct-password');
    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toContain('HttpOnly');
    expect(login.headers['set-cookie']).toContain('SameSite=Strict');
    expect(login.headers['set-cookie']).toContain('Secure');
    expect(login.headers['set-cookie']).not.toContain('correct-password');
    expect(loaded.statusCode).toBe(200);
    expect(loadedVersion).toHaveLength(64);
    expect(save.statusCode).toBe(200);
    expect(conflict.statusCode).toBe(409);
    expect(invalidPartialSchedule.statusCode).toBe(400);
    expect(oversizedSchedule.statusCode).toBe(400);
    expect(conflict.json<{ message: string }>().message).toContain(
      'другой вкладке',
    );
    expect(saved).toEqual([
      {
        faq: [
          {
            answer: 'Напишите оператору.',
            question: 'Как записаться?',
          },
        ],
        directions: [{ id: 'dance', name: 'Бачата' }],
        groups: [
          {
            id: 'group',
            directionId: 'dance',
            name: 'Начинающие',
            meetings: ['Вт / Чт, 19:00'],
            description: 'Для начинающих.',
            enrollmentOpen: false,
            applicationQuestion: '',
          },
        ],
        visibleSections: ['schedule', 'prices', 'address', 'faq'],
      },
    ]);
    expect(catalog.resolve('Частые вопросы')).toContain('❓ Как записаться?');
    expect(readHistory.json()).toEqual({ history });
    expect(restore.statusCode).toBe(200);
    expect(restored).toEqual([7]);
  });

  it('rejects writes from an older schedule editor without changing stored data', async () => {
    const app = createApp({ ...config, nodeEnv: 'development' });
    apps.add(app);
    const saved: unknown[] = [];
    const schedule = [{ dayTime: 'Вт / Чт, 19:00', title: 'Бачата' }];
    const catalog = new ClientInformationCatalog({ schedule });
    const store: ContentSettingsStore = {
      load: () => Promise.resolve(undefined),
      loadHistoricalMenuActions: () => Promise.resolve([]),
      loadRevision: () => Promise.resolve(undefined),
      loadHistory: () => Promise.resolve([]),
      restore: () => Promise.reject(new Error('not available')),
      save: (value) => {
        saved.push(value);
        return Promise.resolve();
      },
    };
    const access = new PasswordSessionAccess(undefined);
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: true,
      secureCookies: false,
    });
    registerManagementRoutes(
      app,
      new ContentManagementService(catalog, store),
      routeAccess,
    );

    const loaded = await app.inject({
      method: 'GET',
      url: '/api/manage/content',
    });
    const snapshot = loaded.json<{
      content: { schedule: string; scheduleItems: unknown[] };
      version: string;
    }>();
    const compatibleSave = await app.inject({
      method: 'POST',
      payload: {
        content: {
          address: 'ул. Мира, 1',
          customSections: [],
          faq: [],
          prices: '',
          schedule: snapshot.content.schedule,
          visibleSections: ['schedule', 'prices', 'address', 'faq'],
        },
        version: snapshot.version,
      },
      url: '/api/manage/content',
    });
    const incompatibleEdit = await app.inject({
      method: 'POST',
      payload: {
        content: {
          address: 'ул. Мира, 1',
          customSections: [],
          faq: [],
          prices: '',
          schedule: 'Изменено в старом редакторе',
          visibleSections: ['schedule', 'prices', 'address', 'faq'],
        },
        version: snapshot.version,
      },
      url: '/api/manage/content',
    });

    expect(snapshot.content.schedule).toBe('Бачата — Вт / Чт, 19:00');
    expect(snapshot.content.scheduleItems).toEqual(schedule);
    expect(compatibleSave.statusCode).toBe(409);
    expect(saved).toEqual([]);
    expect(catalog.getContent().schedule).toEqual(schedule);
    expect(incompatibleEdit.statusCode).toBe(409);
    expect(incompatibleEdit.json<{ message: string }>().message).toContain(
      'Обновите страницу',
    );
  });

  it('stays hidden remotely when no management password is configured', async () => {
    const app = createApp(config);
    apps.add(app);
    const store: ContentSettingsStore = {
      load: () => Promise.resolve(undefined),
      loadHistoricalMenuActions: () => Promise.resolve([]),
      loadRevision: () => Promise.resolve(undefined),
      loadHistory: () => Promise.resolve([]),
      restore: () => Promise.reject(new Error('not available')),
      save: () => Promise.resolve(),
    };
    const access = new PasswordSessionAccess(undefined);
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: false,
      secureCookies: true,
    });
    registerAdminSessionRoutes(app, access, routeAccess, true);
    registerManagementRoutes(
      app,
      new ContentManagementService(new ClientInformationCatalog(), store),
      routeAccess,
    );

    const page = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/manage',
    });
    const session = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/admin/session',
    });

    expect(page.statusCode).toBe(404);
    expect(session.statusCode).toBe(404);
  });

  it('allows loopback development without configuring a password', async () => {
    const app = createApp({ ...config, nodeEnv: 'development' });
    apps.add(app);
    const store: ContentSettingsStore = {
      load: () => Promise.resolve(undefined),
      loadHistoricalMenuActions: () => Promise.resolve([]),
      loadRevision: () => Promise.resolve(undefined),
      loadHistory: () => Promise.resolve([]),
      restore: () => Promise.reject(new Error('not available')),
      save: () => Promise.resolve(),
    };
    const access = new PasswordSessionAccess(undefined);
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: true,
      secureCookies: false,
    });
    registerAdminSessionRoutes(app, access, routeAccess, false);
    registerManagementRoutes(
      app,
      new ContentManagementService(new ClientInformationCatalog(), store),
      routeAccess,
    );

    const content = await app.inject({
      method: 'GET',
      url: '/api/manage/content',
    });

    expect(content.statusCode).toBe(200);
  });
});
