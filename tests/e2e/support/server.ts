import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp } from '@/infrastructure/http/app.js';
import { registerFrontendRoutes } from '@/infrastructure/http/frontend-asset-routes.js';
import { loadFrontendAssets } from '@/infrastructure/http/frontend-assets.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';

const port = readArgument('port', 4174);
const password = readArgument('password');
const app = createApp({
  closedRequestRetentionDays: 7,
  databasePath: './data/e2e-unused.sqlite',
  host: '127.0.0.1',
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

app.get('/api/manage/content', requireAdmin, () => ({
  content: {
    address: 'ул. Примерная, 10',
    faq: [
      {
        answer: 'Напишите нам в мессенджере.',
        question: 'Как записаться?',
      },
    ],
    prices: 'Пробное занятие — бесплатно.',
    schedule: 'Понедельник и среда, 19:00.',
  },
  version: 'a'.repeat(64),
}));
app.get('/api/manage/content/history', requireAdmin, () => ({ history: [] }));
app.get('/api/setup/status', requireAdmin, () => ({
  connected: false,
  locked: false,
  source: 'none',
  vk: { connected: false, locked: false, source: 'none' },
}));
app.get('/api/ops/status', requireAdmin, () => ({
  channels: {
    telegram: {
      configured: true,
      running: true,
      source: 'local',
      state: 'running',
    },
    vk: {
      configured: true,
      running: true,
      source: 'local',
      state: 'running',
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
  operatorRelays: { incidents: [], state: 'healthy', uncertain: 0 },
  outbound: { mode: 'active' },
  startedAt: '2026-09-10T07:00:00.000Z',
  state: 'healthy',
  uptimeSeconds: 3_600,
}));
app.get('/api/ops/service-control', requireAdmin, () => ({
  channels: { telegram: { mode: 'active' }, vk: { mode: 'active' } },
  delivery: { mode: 'active' },
}));
app.get('/api/ops/inbox/requests', requireAdmin, () => ({ requests: [] }));

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
