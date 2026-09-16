import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OperatorActionIncidentService } from '@/core/application/operator-action-incident-service.js';
import { createOperatorLifecycleAction } from '@/core/model/operator-action.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

describe('OperatorActionIncidentService', () => {
  let repository: SqliteSupportRepository;
  let service: OperatorActionIncidentService;

  beforeEach(() => {
    repository = new SqliteSupportRepository(':memory:');
    service = new OperatorActionIncidentService(
      repository,
      () => new Date('2026-09-06T12:01:00.000Z'),
    );
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-06T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: '900',
      status: 'active',
    });
  });

  afterEach(() => repository.close());

  it('keeps Telegram ownership when the operator confirms receipt', async () => {
    createUnknownRelay(repository);

    expect(
      await service.resolve('operator-relay:request-1:message-1:0', 'received'),
    ).toBe(true);

    expect(repository.findRequestById('request-1')?.operatorTopicId).toBe(
      '900',
    );
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 1 });
  });

  it('moves an uncertain relay to web before acknowledging the client', async () => {
    createUnknownRelay(repository);

    expect(
      await service.resolve('operator-relay:request-1:message-1:0', 'use_web'),
    ).toBe(true);

    expect(repository.findRequestById('request-1')?.operatorTopicId).toBe(
      'web:request-1',
    );
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
    expect(
      repository.getUsageEventCounts(new Date('2026-09-06T00:00:00.000Z'))
        .web_takeover,
    ).toBe(1);
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 1 });
  });

  it('acknowledges only after every uncertain chunk is confirmed', async () => {
    createUnknownRelay(repository, 0);
    createUnknownRelay(repository, 1);

    expect(
      await service.resolve('operator-relay:request-1:message-1:0', 'received'),
    ).toBe(true);
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 0 });

    expect(
      await service.resolve('operator-relay:request-1:message-1:1', 'received'),
    ).toBe(true);
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 1 });
  });

  it('requires web takeover while a later chunk is still pending', async () => {
    createUnknownRelay(repository, 0);
    repository.prepareOperatorAction({
      clientMessageId: 'message-1',
      createdAt: new Date('2026-09-06T12:00:00.000Z'),
      id: 'operator-relay:request-1:message-1:1',
      initial: true,
      kind: 'relay_message',
      operatorTopicId: '900',
      requestId: 'request-1',
      sequence: 1,
    });

    expect(
      await service.resolve('operator-relay:request-1:message-1:0', 'received'),
    ).toBe(false);
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 1 });
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 0 });
  });

  it('closes the request only when an uncertain close is confirmed completed', async () => {
    createUnknownLifecycle(repository, 'close_request');

    expect(
      await service.resolve('operator-close:request-1:event-1', 'completed'),
    ).toBe(true);

    expect(repository.findRequestById('request-1')?.status).toBe('closed');
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
  });

  it('leaves the request active when an uncertain close is confirmed incomplete', async () => {
    createUnknownLifecycle(repository, 'close_request');

    expect(
      await service.resolve(
        'operator-close:request-1:event-1',
        'not_completed',
      ),
    ).toBe(true);

    expect(repository.findRequestById('request-1')?.status).toBe('active');
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
  });

  it('reopens the latest request when an uncertain reopen is confirmed completed', async () => {
    repository.closeRequest('request-1', new Date('2026-09-06T12:00:30.000Z'));
    createUnknownLifecycle(repository, 'reopen_request');

    expect(
      await service.resolve('operator-reopen:request-1:event-1', 'completed'),
    ).toBe(true);

    expect(repository.findRequestById('request-1')?.status).toBe('active');
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
  });

  it('retries a failed reopen only through the held-reply continuation', async () => {
    repository.closeRequest('request-1', new Date('2026-09-06T12:00:30.000Z'));
    const action = createOperatorLifecycleAction(
      'reopen_request',
      '900',
      { externalEventId: 'event-held', requestId: 'request-1' },
      new Date('2026-09-06T12:00:31.000Z'),
    );
    repository.holdOperatorReply(
      {
        createdAt: new Date('2026-09-06T12:00:31.000Z'),
        eventSource: 'operator:telegram',
        externalEventId: 'event-held',
        externalMessageId: 'message-held',
        id: 'held-message',
        requestId: 'request-1',
        text: 'Saved reply',
      },
      action,
    );
    repository.markOperatorActionFailed(action.id, 'Telegram topic missing');
    const retry = vi.fn(() => Promise.resolve(true));
    service = new OperatorActionIncidentService(
      repository,
      () => new Date('2026-09-06T12:01:00.000Z'),
      retry,
    );

    expect(await service.resolve(action.id, 'retry')).toBe(true);
    expect(retry).toHaveBeenCalledWith(action.id);

    expect(await service.resolve(action.id, 'use_web')).toBe(true);
    expect(repository.findRequestById('request-1')).toMatchObject({
      operatorTopicId: 'web:request-1',
      status: 'active',
    });
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 1 });
    expect(
      repository.getUsageEventCounts(new Date('2026-09-06T00:00:00.000Z'))
        .web_takeover,
    ).toBe(1);
  });
});

function createUnknownRelay(
  repository: SqliteSupportRepository,
  sequence = 0,
): void {
  const action = {
    clientMessageId: 'message-1',
    createdAt: new Date('2026-09-06T12:00:00.000Z'),
    id: `operator-relay:request-1:message-1:${sequence}`,
    initial: true,
    kind: 'relay_message' as const,
    operatorTopicId: '900',
    requestId: 'request-1',
    sequence,
  };
  repository.prepareOperatorAction(action);
  repository.claimOperatorAction(action.id, action.createdAt);
  repository.markOperatorActionOutcomeUnknown(
    action.id,
    'network response lost',
  );
}

function createUnknownLifecycle(
  repository: SqliteSupportRepository,
  kind: 'close_request' | 'reopen_request',
): void {
  const operation = kind === 'close_request' ? 'close' : 'reopen';
  const action = {
    clientMessageId: 'event-1',
    createdAt: new Date('2026-09-06T12:00:00.000Z'),
    id: `operator-${operation}:request-1:event-1`,
    initial: false,
    kind,
    operatorTopicId: '900',
    requestId: 'request-1',
    sequence: 0,
  };
  repository.prepareOperatorAction(action);
  repository.claimOperatorAction(action.id, action.createdAt);
  repository.markOperatorActionOutcomeUnknown(
    action.id,
    'network response lost',
  );
}
