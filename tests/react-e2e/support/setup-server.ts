import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp } from '@/infrastructure/http/app.js';
import { registerFrontendRoutes } from '@/infrastructure/http/frontend-asset-routes.js';
import { loadFrontendAssets } from '@/infrastructure/http/frontend-assets.js';
import { FileTelegramSettingsStore } from '@/infrastructure/persistence/telegram-settings-store.js';
import { FileVkSettingsStore } from '@/infrastructure/persistence/vk-settings-store.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';
import { VkSetupController } from '@/infrastructure/vk/vk-setup-controller.js';
import { registerSetupRoutes } from '@/modules/channel-setup/presentation/http/routes.js';

// Real HTTP, authorization, controllers and file stores; no network or dotenv.
const root = await mkdtemp(join(tmpdir(), 'inbox-point-react-setup-'));
const app = createApp({
  closedRequestRetentionDays: 7,
  databasePath: join(root, 'unused.sqlite'),
  host: '127.0.0.1',
  instanceId: 'react-setup-test',
  logLevel: 'silent',
  nodeEnv: 'test',
  port: 4192,
});
const password = new PasswordSessionAccess('synthetic-admin-password');
const access = createAdminRouteAccess(app, password, {
  allowLocalBypass: false,
  secureCookies: false,
});
registerAdminSessionRoutes(app, password, access, false);
const telegramStore = new FileTelegramSettingsStore(
  join(root, 'telegram.json'),
);
const vkStore = new FileVkSettingsStore(join(root, 'vk.json'));
let telegramRunning = false;
let vkRunning = false;
const effects: string[] = [];
const telegram = new TelegramSetupController(
  {
    get running() {
      return telegramRunning;
    },
    start: (config) => {
      if (config.operatorChatId === -1002) {
        return Promise.reject(new Error('Topics are disabled'));
      }
      effects.push('telegram:start');
      telegramRunning = true;
      return Promise.resolve();
    },
    stop: () => {
      effects.push('telegram:stop');
      telegramRunning = false;
      return Promise.resolve();
    },
  },
  telegramStore,
  'none',
  () =>
    Promise.resolve(
      Response.json({
        ok: true,
        result: [
          {
            message: {
              chat: {
                id: -1001,
                is_forum: true,
                title:
                  'Группа сотрудников с длинным названием для проверки интерфейса',
                type: 'supergroup',
              },
            },
          },
          {
            message: {
              chat: {
                id: -1002,
                is_forum: false,
                title: 'Группа без тем',
                type: 'supergroup',
              },
            },
          },
        ],
      }),
    ),
);
const vk = new VkSetupController(
  {
    get running() {
      return vkRunning;
    },
    start: () => {
      effects.push('vk:start');
      vkRunning = true;
      return Promise.resolve();
    },
    stop: () => {
      effects.push('vk:stop');
      vkRunning = false;
      return Promise.resolve();
    },
  },
  vkStore,
  'none',
  (token) => ({
    getTokenPermissions: () =>
      Promise.resolve({
        names: token.includes('missing-messages')
          ? ['manage']
          : ['manage', 'messages'],
      }),
    resolveCommunity: () => Promise.resolve(12345),
    getLongPollSettings: () =>
      Promise.resolve({ enabled: true, messageNew: true, messageReply: true }),
    getLongPollServer: () => Promise.resolve({}),
  }),
);
registerSetupRoutes(app, telegram, vk, access);
const repository = new SqliteSupportRepository(join(root, 'support.sqlite'));
repository.createRequest({
  id: 'synthetic-request',
  channel: 'vk',
  conversationId: 'synthetic-client',
  createdAt: new Date('2026-10-19T00:00:00Z'),
  operatorTopicId: 'synthetic-topic',
  status: 'active',
});
const requireAdmin = { preHandler: access.requireAuthorization };
repository.recordConversationMessage({
  id: 'synthetic-message',
  requestId: 'synthetic-request',
  externalMessageId: 'external-synthetic',
  direction: 'client_to_operator',
  text: 'Синтетический вопрос для проверки сохранности истории',
  createdAt: new Date('2026-10-19T00:00:01Z'),
});
app.get('/api/manage/content', requireAdmin, () => ({
  content: {
    organizationName: 'Учебная организация',
    schedule: '',
    scheduleItems: [],
  },
  version: 'a'.repeat(64),
}));
app.get('/api/test/state', requireAdmin, async () => ({
  telegramSaved: Boolean(await telegramStore.load()),
  vkSaved: Boolean(await vkStore.load()),
  request: repository.findRequestById('synthetic-request'),
  messages: repository.findConversationMessages('synthetic-request'),
  effects,
}));
app.addHook('onClose', () => Promise.resolve(repository.close()));
registerFrontendRoutes(app, access, loadFrontendAssets('dist/frontend-react'));
await app.listen({ host: '127.0.0.1', port: 4192 });
