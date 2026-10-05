import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp } from '@/infrastructure/http/app.js';
import { registerFrontendRoutes } from '@/infrastructure/http/frontend-asset-routes.js';
import { loadFrontendAssets } from '@/infrastructure/http/frontend-assets.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { AnalyticsService } from '@/modules/analytics/application/analytics-service.js';
import { registerAnalyticsRoute } from '@/modules/analytics/presentation/http/analytics-route.js';
import {
  emergencyOperations,
  designContent,
  designRequests,
  designMessages,
} from './design-fixtures.js';

const port = readArgument('port', 4174);
const password = readArgument('password');
const designScenario = readArgument('scenario') === 'design';
const app = createApp({
  closedRequestRetentionDays: 7,
  databasePath: './data/e2e-unused.sqlite',
  host: '127.0.0.1',
  instanceId: 'default',
  logLevel: 'silent',
  nodeEnv: 'test',
  port,
});
const passwordAccess = new PasswordSessionAccess(password);
const routeAccess = createAdminRouteAccess(app, passwordAccess, {
  allowLocalBypass: true,
  secureCookies: false,
});
const requireAdmin = { preHandler: routeAccess.requireAuthorization };

registerAdminSessionRoutes(app, passwordAccess, routeAccess, false);
const analyticsRepository = new SqliteSupportRepository(':memory:');
const analyticsNow = new Date('2026-10-04T12:00:00Z');
for (let index = 0; index < 14; index++) {
  analyticsRepository.recordUsageEvent({
    id: `request:${index}`,
    channel: index < 8 ? 'telegram' : 'vk',
    type: 'new_request',
    occurredAt: new Date(analyticsNow.getTime() - (index % 7) * 86_400_000),
  });
}
for (let index = 0; index < 83; index++) {
  analyticsRepository.recordUsageEvent({
    id: `menu:${index}`,
    channel: index < 52 ? 'telegram' : 'vk',
    type: 'menu_action',
    actionKey:
      index < 50 ? 'prices' : index < 70 ? 'custom:synthetic-id' : 'handoff',
    actionLabel:
      index < 50
        ? 'Цены'
        : index < 70
          ? 'Записаться на первое пробное занятие'
          : 'Задать вопрос',
    occurredAt: new Date(analyticsNow.getTime() - (index % 7) * 86_400_000),
  });
}
registerAnalyticsRoute(
  app,
  new AnalyticsService(analyticsRepository, () => analyticsNow),
  routeAccess,
);
app.addHook('onClose', () => Promise.resolve(analyticsRepository.close()));

app.get('/api/manage/content', requireAdmin, () =>
  designScenario
    ? { content: designContent, version: 'a'.repeat(64) }
    : {
        content: {
          address: 'ул. Примерная, 10',
          faq: [
            {
              answer: 'Напишите нам в мессенджере.',
              question: 'Как записаться?',
            },
          ],
          prices: 'Пробное занятие — бесплатно.',
          schedule: '',
          scheduleItems: [
            {
              dayTime: 'Понедельник и среда, 19:00.',
              title: 'Бачата — начинающие',
            },
          ],
        },
        version: 'a'.repeat(64),
      },
);
app.get('/api/manage/content/history', requireAdmin, () => ({ history: [] }));
app.get('/api/setup/status', requireAdmin, () => ({
  connected: false,
  locked: false,
  source: 'none',
  vk: { connected: false, locked: false, source: 'none' },
}));
app.get('/api/ops/status', requireAdmin, () =>
  designScenario
    ? emergencyOperations
    : {
        channels: {
          telegram: {
            configured: false,
            running: false,
            source: 'none',
            state: 'not_configured',
          },
          vk: {
            configured: false,
            running: false,
            source: 'none',
            state: 'not_configured',
          },
        },
        deliveries: {
          failed: 0,
          incidents: [],
          pending: 0,
          state: 'healthy',
          uncertain: 0,
          worker: { running: true, state: 'running' },
        },
        inboundEvents: { incidents: [], quarantined: 0, state: 'healthy' },
        intake: { telegram: { mode: 'active' }, vk: { mode: 'active' } },
        observedAt: '2026-09-10T08:00:00.000Z',
        operatorInbox: {
          recoverableWebRequests: 0,
          state: 'healthy',
          webOwnedRequests: 0,
        },
        operatorRelays: { incidents: [], state: 'healthy', uncertain: 0 },
        outbound: { mode: 'active' },
        startedAt: '2026-09-10T07:00:00.000Z',
        state: 'attention',
        uptimeSeconds: 3_600,
      },
);
app.get('/api/ops/service-control', requireAdmin, () => ({
  channels: { telegram: { mode: 'active' }, vk: { mode: 'active' } },
  delivery: { mode: 'active' },
}));
app.get('/api/ops/inbox/requests', requireAdmin, () => ({
  requests: designScenario ? designRequests : [],
}));
app.get<{ Params: { id: string } }>(
  '/api/ops/inbox/requests/:id/messages',
  requireAdmin,
  (request) => ({
    messages: designScenario ? designMessages(request.params.id) : [],
  }),
);

registerFrontendRoutes(app, routeAccess, loadFrontendAssets());
await app.listen({ host: '127.0.0.1', port });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close().then(() => process.exit(0)));
}

function readArgument(name: string, fallback: number): number;
function readArgument(name: string, fallback?: undefined): string | undefined;
function readArgument(
  name: string,
  fallback?: number,
): string | number | undefined {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  if (!value) {
    return fallback;
  }
  const parsed = value.slice(prefix.length);
  return typeof fallback === 'number' ? Number(parsed) : parsed;
}
