import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import type {
  ContentChange,
  ContentSettingsStore,
} from '@/infrastructure/persistence/content-settings-store.js';
import { createApp } from './app.js';
import { ContentManagementAccess } from './content-management-access.js';
import { ContentSetupController } from './content-setup-controller.js';
import { registerManagementRoutes } from './manage-routes.js';

const config: RuntimeConfig = {
  databasePath: './data/test.sqlite',
  host: '0.0.0.0',
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
    const saved: unknown[] = [];
    const store: ContentSettingsStore = {
      load: () => Promise.resolve(undefined),
      loadHistory: () => Promise.resolve(history),
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
      new ContentSetupController(catalog, store),
      new ContentManagementAccess('correct-password', {
        createToken: () => 'synthetic-session-token',
      }),
      { allowLocalBypass: false, secureCookies: true },
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
    if (!cookie) throw new Error('Expected a session cookie value');
    const save = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'https://example.test',
      },
      method: 'POST',
      payload: {
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
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content',
    });
    const readHistory = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/manage/content/history',
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
    expect(save.statusCode).toBe(200);
    expect(saved).toEqual([
      {
        faq: [
          {
            answer: 'Напишите преподавателю.',
            question: 'Как записаться?',
          },
        ],
      },
    ]);
    expect(catalog.resolve('Частые вопросы')).toContain('❓ Как записаться?');
    expect(readHistory.json()).toEqual({ history });
  });

  it('stays hidden remotely when no management password is configured', async () => {
    const app = createApp(config);
    apps.add(app);
    const store: ContentSettingsStore = {
      load: () => Promise.resolve(undefined),
      loadHistory: () => Promise.resolve([]),
      save: () => Promise.resolve(),
    };
    registerManagementRoutes(
      app,
      new ContentSetupController(new ClientInformationCatalog(), store),
      new ContentManagementAccess(undefined),
      { allowLocalBypass: false, secureCookies: true },
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
      save: () => Promise.resolve(),
    };
    registerManagementRoutes(
      app,
      new ContentSetupController(new ClientInformationCatalog(), store),
      new ContentManagementAccess(undefined),
      { allowLocalBypass: true, secureCookies: false },
    );

    const content = await app.inject({
      method: 'GET',
      url: '/api/manage/content',
    });

    expect(content.statusCode).toBe(200);
  });
});
