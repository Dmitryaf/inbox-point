import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { HandoffRuntime } from '@/core/application/handoff-runtime.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp } from '@/infrastructure/http/app.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { OperatorInboxService } from '@/modules/operator-inbox/application/operator-inbox-service.js';
import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import { registerOperationsRoutes } from '@/modules/operations-monitoring/presentation/http/routes.js';

const config: RuntimeConfig = {
  closedRequestRetentionDays: 7,
  databasePath: './data/test.sqlite',
  host: '0.0.0.0',
  logLevel: 'silent',
  nodeEnv: 'production',
  port: 3000,
};
const apps = new Set<ReturnType<typeof createApp>>();
const repositories = new Set<SqliteSupportRepository>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
  for (const repository of repositories) {
    repository.close();
  }
  repositories.clear();
});

describe('operator inbox routes', () => {
  it('protects, reads, replies to and closes an emergency web request', async () => {
    const app = createApp(config);
    const repository = new SqliteSupportRepository(':memory:');
    const handoff = new HandoffRuntime({
      logger: { error: () => undefined },
      repository,
    });
    apps.add(app);
    repositories.add(repository);
    await handoff.handleClientMessage('vk-event-1', {
      channel: 'vk',
      conversationId: '101',
      displayName: 'Test Customer',
      externalMessageId: 'vk-message-1',
      receivedAt: new Date('2026-09-06T12:00:00.000Z'),
      text: 'Question during Telegram outage',
    });
    const requestId = repository.findActiveRequest('vk', '101')?.id;
    if (!requestId) {
      throw new Error('Expected an active request');
    }
    repository.createRequest({
      channel: 'telegram',
      conversationId: '202',
      createdAt: new Date('2026-09-06T12:00:30.000Z'),
      displayName: 'Telegram Customer',
      id: 'telegram-request',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    const access = new PasswordSessionAccess('correct-admin-password', {
      createToken: () => 'synthetic-admin-session',
    });
    const routeAccess = createAdminRouteAccess(app, access, {
      allowLocalBypass: false,
      secureCookies: true,
    });
    registerAdminSessionRoutes(app, access, routeAccess, true);
    registerOperationsRoutes(
      app,
      createMonitoringService(),
      routeAccess,
      { assets: { html: '', script: '', styles: '' } },
      undefined,
      undefined,
      new OperatorInboxService(repository, handoff),
    );

    const unauthorized = await app.inject({
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/ops/inbox/requests',
    });
    const login = await app.inject({
      headers: { host: 'example.test', origin: 'http://example.test' },
      method: 'POST',
      payload: { password: 'correct-admin-password' },
      remoteAddress: '192.0.2.10',
      url: '/api/admin/login',
    });
    const cookie = readSessionCookie(login.headers['set-cookie']);
    const requests = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/ops/inbox/requests',
    });
    const messages = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: `/api/ops/inbox/requests/${requestId}/messages`,
    });
    const telegramMessages = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/ops/inbox/requests/telegram-request/messages',
    });
    const crossOriginReply = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'https://attacker.test',
      },
      method: 'POST',
      payload: { idempotencyKey: 'reply-1', text: 'Answer' },
      remoteAddress: '192.0.2.10',
      url: `/api/ops/inbox/requests/${requestId}/replies`,
    });
    const reply = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: { idempotencyKey: 'reply-1', text: 'Answer' },
      remoteAddress: '192.0.2.10',
      url: `/api/ops/inbox/requests/${requestId}/replies`,
    });
    const duplicateReply = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: { idempotencyKey: 'reply-1', text: 'Answer' },
      remoteAddress: '192.0.2.10',
      url: `/api/ops/inbox/requests/${requestId}/replies`,
    });
    const updatedMessages = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: `/api/ops/inbox/requests/${requestId}/messages`,
    });
    const close = await app.inject({
      headers: {
        cookie,
        host: 'example.test',
        origin: 'http://example.test',
      },
      method: 'POST',
      payload: { idempotencyKey: 'close-1' },
      remoteAddress: '192.0.2.10',
      url: `/api/ops/inbox/requests/${requestId}/close`,
    });
    const afterClose = await app.inject({
      headers: { cookie },
      method: 'GET',
      remoteAddress: '192.0.2.10',
      url: '/api/ops/inbox/requests',
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(requests.json()).toMatchObject({
      requests: [
        {
          channel: 'vk',
          displayName: 'Test Customer',
          id: requestId,
        },
      ],
    });
    expect(requests.body).not.toContain('conversationId');
    expect(requests.body).not.toContain('operatorTopicId');
    expect(messages.json()).toMatchObject({
      messages: [
        {
          direction: 'client_to_operator',
          text: 'Question during Telegram outage',
        },
      ],
    });
    expect(messages.body).not.toContain('externalMessageId');
    expect(messages.body).not.toContain('requestId');
    expect(telegramMessages.statusCode).toBe(404);
    expect(crossOriginReply.statusCode).toBe(403);
    expect(reply.json()).toEqual({ queued: true });
    expect(duplicateReply.json()).toEqual({ queued: true });
    expect(
      repository.getUsageEventCounts(new Date('2026-01-01')).web_takeover,
    ).toBe(1);
    expect(repository.findPendingDeliveries(new Date(), 10)).toHaveLength(1);
    const updatedMessagePayload = updatedMessages.json<{
      messages: {
        deliveryOutcomeUnknown?: boolean;
        deliveryStatus?: string;
        direction: string;
        text: string;
      }[];
    }>();
    expect(
      updatedMessagePayload.messages.find(
        (message) => message.direction === 'client_to_operator',
      )?.text,
    ).toBe('Question during Telegram outage');
    expect(
      updatedMessagePayload.messages.find(
        (message) => message.direction === 'operator_to_client',
      ),
    ).toMatchObject({
      deliveryOutcomeUnknown: false,
      deliveryStatus: 'pending',
      text: 'Answer',
    });
    expect(close.json()).toEqual({ closed: true });
    expect(afterClose.json()).toEqual({ requests: [] });
  });
});

function createMonitoringService(): OperationsMonitoringService {
  return new OperationsMonitoringService({
    channelActivity: () => ({}),
    clock: () => new Date('2026-09-06T12:01:00.000Z'),
    deliveryActivity: () => ({ running: false }),
    deliverySummary: () => ({ failed: 0, pending: 0 }),
    startedAt: new Date('2026-09-06T12:00:00.000Z'),
    telegramStatus: () => ({ connected: false, source: 'none' }),
    vkStatus: () => ({ connected: true, source: 'local' }),
  });
}

function readSessionCookie(setCookie: unknown): string {
  const header =
    typeof setCookie === 'string'
      ? setCookie
      : Array.isArray(setCookie) && typeof setCookie[0] === 'string'
        ? setCookie[0]
        : undefined;
  if (!header) {
    throw new Error('Expected a session cookie');
  }
  const [cookie] = header.split(';', 1);
  if (!cookie) {
    throw new Error('Expected a session cookie value');
  }
  return cookie;
}
