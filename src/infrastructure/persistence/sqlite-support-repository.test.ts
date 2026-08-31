import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SqliteSupportRepository } from './sqlite-support-repository.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('SqliteSupportRepository', () => {
  it('restores request and duplicate-event state after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');

    const first = new SqliteSupportRepository(databasePath);
    first.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-08-31T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    expect(
      first.claimEvent(
        'client:telegram',
        'update-1',
        new Date('2026-08-31T12:00:00.000Z'),
      ),
    ).toBe(true);
    first.closeRequest('request-1', new Date('2026-08-31T12:05:00.000Z'));
    first.close();

    const second = new SqliteSupportRepository(databasePath);
    expect(second.findRequestByTopicId('topic-1')).toMatchObject({
      closedAt: new Date('2026-08-31T12:05:00.000Z'),
      conversationId: '101',
      id: 'request-1',
      status: 'closed',
    });
    expect(
      second.claimEvent(
        'client:telegram',
        'update-1',
        new Date('2026-08-31T12:10:00.000Z'),
      ),
    ).toBe(false);
    second.close();
  });
});
