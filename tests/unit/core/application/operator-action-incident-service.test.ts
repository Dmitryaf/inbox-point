import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OperatorActionIncidentService } from '@/core/application/operator-action-incident-service.js';
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

  it('keeps Telegram ownership when the operator confirms receipt', () => {
    createUnknownRelay(repository);

    expect(
      service.resolve('operator-relay:request-1:message-1:0', 'received'),
    ).toBe(true);

    expect(repository.findRequestById('request-1')?.operatorTopicId).toBe(
      '900',
    );
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 1 });
  });

  it('moves an uncertain relay to web before acknowledging the client', () => {
    createUnknownRelay(repository);

    expect(
      service.resolve('operator-relay:request-1:message-1:0', 'use_web'),
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

  it('acknowledges only after every uncertain chunk is confirmed', () => {
    createUnknownRelay(repository, 0);
    createUnknownRelay(repository, 1);

    expect(
      service.resolve('operator-relay:request-1:message-1:0', 'received'),
    ).toBe(true);
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 0 });

    expect(
      service.resolve('operator-relay:request-1:message-1:1', 'received'),
    ).toBe(true);
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 1 });
  });

  it('requires web takeover while a later chunk is still pending', () => {
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
      service.resolve('operator-relay:request-1:message-1:0', 'received'),
    ).toBe(false);
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 1 });
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 0 });
  });

  it('closes the request only when an uncertain close is confirmed completed', () => {
    createUnknownLifecycle(repository, 'close_request');

    expect(
      service.resolve('operator-close:request-1:event-1', 'completed'),
    ).toBe(true);

    expect(repository.findRequestById('request-1')?.status).toBe('closed');
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
  });

  it('leaves the request active when an uncertain close is confirmed incomplete', () => {
    createUnknownLifecycle(repository, 'close_request');

    expect(
      service.resolve('operator-close:request-1:event-1', 'not_completed'),
    ).toBe(true);

    expect(repository.findRequestById('request-1')?.status).toBe('active');
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
  });

  it('reopens the latest request when an uncertain reopen is confirmed completed', () => {
    repository.closeRequest('request-1', new Date('2026-09-06T12:00:30.000Z'));
    createUnknownLifecycle(repository, 'reopen_request');

    expect(
      service.resolve('operator-reopen:request-1:event-1', 'completed'),
    ).toBe(true);

    expect(repository.findRequestById('request-1')?.status).toBe('active');
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
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
