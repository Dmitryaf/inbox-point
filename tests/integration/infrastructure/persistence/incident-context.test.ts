import { describe, expect, it } from 'vitest';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

describe('incident context', () => {
  it('joins the exact request, message and direction and excludes lifecycle collisions', () => {
    const db = new SqliteSupportRepository(':memory:');
    const createdAt = new Date('2026-09-01T12:00:00Z');
    try {
      db.createRequest({
        id: 'A',
        channel: 'vk',
        conversationId: '101',
        displayName: 'Synthetic customer',
        operatorTopicId: '900',
        createdAt,
        status: 'active',
      });
      for (const direction of [
        'client_to_operator',
        'operator_to_client',
      ] as const) {
        db.recordConversationMessage({
          id: direction,
          requestId: 'A',
          externalMessageId: 'same-id',
          direction,
          text: direction,
          createdAt,
        });
      }
      for (const kind of [
        'relay_message',
        'mirror_operator_message',
        'close_request',
        'reopen_request',
      ] as const) {
        db.prepareOperatorAction({
          id: kind,
          requestId: 'A',
          clientMessageId: 'same-id',
          kind,
          initial: false,
          sequence: 0,
          operatorTopicId: '900',
          createdAt,
        });
        db.claimOperatorAction(kind, createdAt);
        db.markOperatorActionOutcomeUnknown(kind, 'synthetic network error');
      }
      const incidents = db.findOperatorActionIncidents(10);
      expect(incidents).toHaveLength(4);
      expect(incidents.find((i) => i.kind === 'relay_message')).toMatchObject({
        displayName: 'Synthetic customer',
        messageText: 'client_to_operator',
      });
      expect(
        incidents.find((i) => i.kind === 'mirror_operator_message'),
      ).toMatchObject({ messageText: 'operator_to_client' });
      expect(
        incidents.find((i) => i.kind === 'close_request')?.messageText,
      ).toBeUndefined();
      expect(
        incidents.find((i) => i.kind === 'reopen_request')?.messageText,
      ).toBeUndefined();
      db.enqueueDelivery({
        id: 'delivery',
        requestId: 'A',
        channel: 'vk',
        conversationId: '101',
        operatorMessageId: 'same-id',
        idempotencyKey: 'delivery',
        text: 'Exact outgoing chunk',
        createdAt,
      });
      db.claimDeliveryAttempt('delivery', createdAt);
      db.markDeliveryOutcomeUnknown('delivery', 'synthetic network error');
      expect(db.findFailedDeliveries(10)[0]).toMatchObject({
        displayName: 'Synthetic customer',
        messageText: 'Exact outgoing chunk',
      });
    } finally {
      db.close();
    }
  });
});
