import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { HandoffService } from '@/core/application/handoff-service.js';
import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import { createOperatorLifecycleAction } from '@/core/model/operator-action.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import type { TelegramGateway } from '@/infrastructure/telegram/telegram-api-client.js';
import { TelegramTopicsInbox } from '@/infrastructure/telegram/telegram-topics-inbox.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('operator relay restart recovery', () => {
  it('does not repeat a Telegram side effect interrupted before persistence', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const createdAt = new Date('2026-09-06T12:00:00.000Z');
    const action = {
      clientMessageId: 'client-message-1',
      createdAt,
      id: 'operator-relay:request-1:client-message-1:0',
      initial: false,
      kind: 'relay_message' as const,
      operatorTopicId: '900',
      requestId: 'request-1',
      sequence: 0,
    };
    const beforeCrash = new SqliteSupportRepository(databasePath);
    beforeCrash.createRequest({
      channel: 'vk',
      conversationId: '101',
      createdAt,
      id: 'request-1',
      operatorTopicId: '900',
      status: 'active',
    });
    beforeCrash.prepareOperatorAction(action);
    beforeCrash.claimOperatorAction(action.id, createdAt);
    // The fake external call has succeeded. Closing here models SIGKILL before
    // the returned Telegram message id can be committed.
    beforeCrash.close();

    const afterRestart = new SqliteSupportRepository(databasePath);
    const sendMessage = vi.fn(() => Promise.resolve({ messageId: 701 }));
    const gateway = createGateway(sendMessage);
    const handoff = new HandoffService({
      operatorInbox: new TelegramTopicsInbox(gateway, -1_001, afterRestart),
      repository: afterRestart,
    });
    const message = {
      channel: 'vk' as const,
      conversationId: '101',
      displayName: 'Test Customer',
      externalMessageId: 'client-message-1',
      receivedAt: createdAt,
      text: 'Question',
    };

    await handoff.handleClientMessage('vk-event-1', message);
    await handoff.handleClientMessage('vk-event-1', message);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(afterRestart.findRequestById('request-1')?.operatorTopicId).toBe(
      '900',
    );
    expect(afterRestart.getOperatorActionSummary()).toEqual({ uncertain: 1 });
    afterRestart.close();
  });

  it('keeps a held operator reply across restart until reopen is resolved', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const createdAt = new Date('2026-09-16T12:00:00.000Z');
    const beforeRestart = new SqliteSupportRepository(databasePath);
    beforeRestart.createRequest({
      channel: 'telegram',
      closedAt: createdAt,
      conversationId: '101',
      createdAt,
      id: 'request-held',
      operatorTopicId: '900',
      status: 'closed',
    });
    const gateway = createGateway(() => Promise.resolve({ messageId: 701 }));
    gateway.reopenForumTopic = () =>
      Promise.reject(new DeliveryOutcomeUnknownError('telegram'));
    const handoff = new HandoffService({
      operatorInbox: new TelegramTopicsInbox(gateway, -1_001, beforeRestart),
      repository: beforeRestart,
    });

    await handoff.handleOperatorMessage('update-held', {
      externalMessageId: 'operator-message-held',
      operatorTopicId: '900',
      receivedAt: createdAt,
      text: 'Сохранённый ответ',
    });
    expect(beforeRestart.findOperatorActionIncidents(10)[0]).toMatchObject({
      heldReplyCount: 1,
      status: 'outcome_unknown',
    });
    beforeRestart.close();

    const afterRestart = new SqliteSupportRepository(databasePath);
    const incident = afterRestart.findOperatorActionIncidents(10)[0];
    if (!incident) {
      throw new Error('Expected the held reply incident after restart');
    }
    expect(
      afterRestart.resolveOperatorLifecycleAction(
        incident.id,
        'completed',
        new Date('2026-09-16T12:01:00.000Z'),
      ),
    ).toBe(true);
    expect(afterRestart.findRequestById('request-held')?.status).toBe('active');
    expect(afterRestart.findConversationMessages('request-held', 10)).toEqual([
      expect.objectContaining({ text: 'Сохранённый ответ' }),
    ]);
    expect(afterRestart.getDeliverySummary()).toMatchObject({ pending: 1 });
    afterRestart.close();
  });

  it('keeps a superseded held reply deliverable after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const createdAt = new Date('2026-09-16T12:00:00.000Z');
    const beforeRestart = new SqliteSupportRepository(databasePath);
    beforeRestart.createRequest({
      channel: 'telegram',
      closedAt: createdAt,
      conversationId: '101',
      createdAt,
      id: 'request-old',
      operatorTopicId: '900',
      status: 'closed',
    });
    const action = createOperatorLifecycleAction(
      'reopen_request',
      '900',
      { externalEventId: 'update-held', requestId: 'request-old' },
      createdAt,
    );
    beforeRestart.holdOperatorReply(
      {
        createdAt,
        eventSource: 'operator:telegram',
        externalEventId: 'update-held',
        externalMessageId: 'operator-message-held',
        id: 'held-message',
        requestId: 'request-old',
        text: 'Late answer',
      },
      action,
    );
    expect(beforeRestart.claimOperatorAction(action.id, createdAt)).toBe(true);
    beforeRestart.markOperatorActionOutcomeUnknown(
      action.id,
      'Telegram outcome is unknown',
    );

    expect(
      beforeRestart.createNextRequest({
        channel: 'telegram',
        conversationId: '101',
        createdAt: new Date('2026-09-16T12:01:00.000Z'),
        id: 'request-new',
        operatorTopicId: 'web:request-new',
        status: 'active',
      }),
    ).toBe(true);
    beforeRestart.close();

    const afterRestart = new SqliteSupportRepository(databasePath);
    expect(afterRestart.findRequestById('request-old')?.status).toBe('closed');
    expect(afterRestart.findRequestById('request-new')?.status).toBe('active');
    expect(afterRestart.findOperatorActionIncidents(10)).toEqual([]);
    expect(afterRestart.findConversationMessages('request-old', 10)).toEqual([
      expect.objectContaining({ text: 'Late answer' }),
    ]);
    expect(
      afterRestart.findPendingDeliveries(
        new Date('2026-09-16T12:02:00.000Z'),
        10,
      ),
    ).toEqual([expect.objectContaining({ text: 'Late answer' })]);
    afterRestart.close();
  });
});

function createGateway(
  sendMessage: TelegramGateway['sendMessage'],
): TelegramGateway {
  return {
    closeForumTopic: () => Promise.resolve(),
    createForumTopic: () => Promise.resolve({ topicId: 900 }),
    getUpdates: () => Promise.resolve([]),
    reopenForumTopic: () => Promise.resolve(),
    sendMessage,
  };
}
