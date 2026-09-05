import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { createApp } from '@/infrastructure/http/app.js';
import { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import type {
  ContentChange,
  ContentSettingsStore,
} from '@/modules/content-management/application/ports/content-settings-store.js';
import { registerManagementRoutes } from '@/modules/content-management/presentation/http/routes.js';
import { ContentManagementAccess } from '@/modules/content-management/security/content-management-access.js';

const config: RuntimeConfig = {
  databasePath: './data/test.sqlite',
  host: '0.0.0.0',
  logLevel: 'silent',
  nodeEnv: 'production',
  port: 3000,
};

const apps = new Set<ReturnType<typeof createApp>>();
const managementAssets = {
  html: '<!doctype html><title>Информация для клиентов</title>',
  script: 'globalThis.managementApp = true;',
  styles: ':root { color: black; }',
};

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
      loadHistory: () => Promise.resolve(history),
      restore: (revision) => {
        restored.push(revision);
        return Promise.resolve({
          faq: [
            {
              answer: 'Напишите преподавателю.',
              question: 'Как записаться?',
            },
          ],
          schedule: 'Восстановлено',
        });
      },
      save: (content) => {
        saved.push(content);
        history.unshift({
          changedAt: '2026-09-01T12:00:00.000Z',
          sections: ['faq'],
        });
        return Promise.resolve();
      },
    };
    registerManagementRoutes(
      app,
      new ContentManagementService(catalog, store),
      new ContentManagementAccess('correct-password', {
        createToken: () => 'synthetic-session-token',
      }),
      {
        allowLocalBypass: false,
        assets: managementAssets,
        secureCookies: true,
      },
    );

    const page = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/manage',
    });
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
      url: '/api/manage/login',
    });
    const wrong = await app.inject({
      headers: {
        host: 'example.test',
        origin: 'https://example.test',
      },
      method: 'POST',
      payload: { password: 'wrong-password' },
      remoteAddress: '192.0.2.10',
      url: '/api/manage/login',
    });
    const login = await app.inject({
      headers: {
        host: 'example.test',
        origin: 'https://example.test',
      },
      method: 'POST',
      payload: { password: 'correct-password' },
      remoteAddress: '192.0.2.10',
      url: '/api/manage/login',
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
    const save = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'https://example.test',
      },
      method: 'POST',
      payload: {
        content: {
          address: '',
          customSections: [],
          faq: [
            {
              answer: 'Напишите преподавателю.',
              question: 'Как записаться?',
            },
          ],
          prices: '',
          schedule: '',
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
        origin: 'https://example.test',
      },
      method: 'POST',
      payload: {
        content: {
          address: '',
          customSections: [],
          faq: [],
          prices: '',
          schedule: 'Конфликтующая версия',
        },
        version: loadedVersion,
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
        origin: 'https://example.test',
      },
      method: 'POST',
      payload: {
        revision: 7,
        version: save.json<{ version: string }>().version,
      },
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content/restore',
    });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Информация для клиентов');
    expect(page.body).not.toContain('Токен');
    expect(page.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
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
    expect(conflict.json<{ message: string }>().message).toContain(
      'другой вкладке',
    );
    expect(saved).toEqual([
      {
        faq: [
          {
            answer: 'Напишите преподавателю.',
            question: 'Как записаться?',
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

  it('stays hidden remotely when no management password is configured', async () => {
    const app = createApp(config);
    apps.add(app);
    const store: ContentSettingsStore = {
      load: () => Promise.resolve(undefined),
      loadHistory: () => Promise.resolve([]),
      restore: () => Promise.reject(new Error('not available')),
      save: () => Promise.resolve(),
    };
    registerManagementRoutes(
      app,
      new ContentManagementService(new ClientInformationCatalog(), store),
      new ContentManagementAccess(undefined),
      {
        allowLocalBypass: false,
        assets: managementAssets,
        secureCookies: true,
      },
    );

    const page = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/manage',
    });
    const session = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/manage/session',
    });

    expect(page.statusCode).toBe(404);
    expect(session.statusCode).toBe(404);
  });

  it('allows loopback development without configuring a password', async () => {
    const app = createApp({ ...config, nodeEnv: 'development' });
    apps.add(app);
    const store: ContentSettingsStore = {
      load: () => Promise.resolve(undefined),
      loadHistory: () => Promise.resolve([]),
      restore: () => Promise.reject(new Error('not available')),
      save: () => Promise.resolve(),
    };
    registerManagementRoutes(
      app,
      new ContentManagementService(new ClientInformationCatalog(), store),
      new ContentManagementAccess(undefined),
      {
        allowLocalBypass: true,
        assets: managementAssets,
        secureCookies: false,
      },
    );

    const content = await app.inject({
      method: 'GET',
      url: '/api/manage/content',
    });

    expect(content.statusCode).toBe(200);
  });
});
