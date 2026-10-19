import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { HandoffRuntime } from '@/core/application/handoff-runtime.js';
import { OperatorActionIncidentService } from '@/core/application/operator-action-incident-service.js';
import { InboundEventIncidentService } from '@/core/application/inbound-event-incident-service.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp } from '@/infrastructure/http/app.js';
import { registerFrontendRoutes } from '@/infrastructure/http/frontend-asset-routes.js';
import { loadFrontendAssets } from '@/infrastructure/http/frontend-assets.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { OperatorInboxService } from '@/modules/operator-inbox/application/operator-inbox-service.js';
import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import { registerOperationsRoutes } from '@/modules/operations-monitoring/presentation/http/routes.js';
import { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';
import { FileServiceControlStore } from '@/modules/service-control/infrastructure/file-store/file-service-control-store.js';
import { createDefaultServiceControlState } from '@/modules/service-control/model/service-control-state.js';
import { seedOperationsIncidents } from './operations-seed.js';

// Every instance owns a new SQLite and control store; no env or external ports.
const root = await mkdtemp(join(tmpdir(), 'inbox-point-react-operations-'));
const port = Number(
  process.argv.find((value) => value.startsWith('--port='))?.slice(7) ?? 4193,
);
const now = new Date();
const app = createApp({
  closedRequestRetentionDays: 7,
  databasePath: join(root, 'unused.sqlite'),
  host: '127.0.0.1',
  instanceId: 'react-operations-test',
  logLevel: 'silent',
  nodeEnv: 'test',
  port,
});
const repository = new SqliteSupportRepository(join(root, 'support.sqlite'));
const evidenceDatabase = new DatabaseSync(join(root, 'support.sqlite'), {
  readOnly: true,
});
const store = new FileServiceControlStore(join(root, 'control.json'));
const control = new ServiceControlService(
  createDefaultServiceControlState(),
  store,
  () => now,
);
const handoff = new HandoffRuntime({
  repository,
  logger: { error: () => undefined },
  clock: () => now,
  deliveryPolicy: control,
});
const ids: string[] = [];
for (const [id, conversationId] of [
  ['A', '101'],
  ['B', '202'],
] as const) {
  await handoff.handleClientMessage(`seed-${id}`, {
    channel: 'vk',
    conversationId,
    displayName: `Клиент ${id} с длинным именем для проверки переписки`,
    externalMessageId: `external-${id}`,
    receivedAt: now,
    text: `Message ${id}. Синтетический вопрос о первом занятии, расписании и возможности записаться на пробное занятие.`,
  });
  ids.push(repository.findActiveRequest('vk', conversationId)!.id);
}
for (let index = 0; index < 20; index++) {
  repository.recordConversationMessage({
    id: `history-${index}`,
    requestId: ids[0]!,
    externalMessageId: `external-history-${index}`,
    createdAt: now,
    direction: 'client_to_operator',
    senderName: 'Синтетический клиент A',
    text: `Запись ${index + 1}: подробный синтетический вопрос о расписании и пробном занятии для проверки прокрутки переписки.`,
  });
}
seedOperationsIncidents(repository, now);
const password = new PasswordSessionAccess('synthetic-admin-password');
const access = createAdminRouteAccess(app, password, {
  allowLocalBypass: false,
  secureCookies: false,
});
registerAdminSessionRoutes(app, password, access, false);
const monitoring = new OperationsMonitoringService({
  clock: () => now,
  startedAt: new Date(now.getTime() - 60_000),
  telegramStatus: () => ({ connected: true, source: 'local' }),
  vkStatus: () => ({ connected: true, source: 'local' }),
  channelActivity: (channel) =>
    channel === 'telegram'
      ? { lastSuccessfulPollAt: now }
      : {
          lastFailedPollAt: now,
          consecutiveFailures: 3,
          lastFailure: {
            stage: 'poll',
            request: {
              channel: 'vk',
              kind: 'transport',
              method: 'groups.getLongPollServer',
              operationId: 'synthetic-operation-id',
              durationMs: 15000,
              transportCodes: ['UND_ERR_CONNECT_TIMEOUT'],
            },
          },
        },
  deliveryActivity: () => ({ running: true, lastCycleAt: now }),
  deliverySummary: () => repository.getDeliverySummary(),
  deliveryFailures: () => repository.findFailedDeliveries(100),
  deliveryControlStatus: () => control.getState().delivery,
  intakeStatus: () => control.getState().channels,
  operatorActionSummary: () => repository.getOperatorActionSummary(),
  operatorActionIncidents: () => repository.findOperatorActionIncidents(100),
  inboundEventSummary: () => repository.getInboundEventSummary(),
  inboundEventIncidents: () => repository.findQuarantinedInboundEvents(100),
  webOperatorRequests: () => repository.getWebOperatorRequestSummary(),
});
registerOperationsRoutes(app, access, {
  monitoring,
  deliveries: repository,
  inboundEvents: new InboundEventIncidentService(repository),
  operatorActions: new OperatorActionIncidentService(repository, () => now),
  operatorInbox: new OperatorInboxService(repository, handoff),
  serviceControl: control,
});
const requireAdmin = { preHandler: access.requireAuthorization };
app.get('/api/manage/content', requireAdmin, () => ({
  content: {
    organizationName: 'Учебная организация',
    schedule: '',
    scheduleItems: [],
  },
  version: 'a'.repeat(64),
}));
app.get('/api/test/state', requireAdmin, async () => ({
  ids,
  requests: ids.map((id) => repository.findRequestById(id)),
  messages: ids.map((id) => repository.findConversationMessages(id)),
  pending: evidenceDatabase
    .prepare(
      "SELECT id, request_id AS requestId, external_conversation_id AS conversationId, text, idempotency_key AS idempotencyKey FROM deliveries WHERE status = 'pending' ORDER BY rowid",
    )
    .all(),
  failed: repository.findFailedDeliveries(100),
  control: await store.load(),
}));
app.post<{ Params: { id: string } }>(
  '/api/test/recover/:id',
  { preHandler: [access.requireAuthorization, access.requireSameOrigin] },
  (request) => ({
    changed: repository.switchOperatorTopic(
      request.params.id,
      `web:${request.params.id}`,
      'topic-recovered',
    ),
  }),
);
app.addHook('onClose', () => {
  evidenceDatabase.close();
  repository.close();
  return Promise.resolve();
});
registerFrontendRoutes(app, access, loadFrontendAssets('dist/frontend'));
await app.listen({ host: '127.0.0.1', port });
