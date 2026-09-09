import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { HandoffService } from '@/core/application/handoff-service.js';
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
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
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
