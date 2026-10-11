import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { EnrollmentConfirmationStatus } from '@/core/contracts/class-enrollment-store.js';

export function confirmClassEnrollment(
  database: DatabaseSync,
  repository: SupportRepository,
  enrollmentId: string,
  operatorTopicId: string,
  operatorMessageId: string,
  confirmedAt: Date,
): EnrollmentConfirmationStatus {
  database.exec('BEGIN IMMEDIATE');
  try {
    const message = database
      .prepare(
        `SELECT message.request_id, message.enrollment_confirmation_text AS text
      FROM conversation_messages AS message
      JOIN support_requests AS request ON request.id = message.request_id
      WHERE message.id = ? AND message.direction = 'client_to_operator'
        AND message.enrollment_confirmation_text IS NOT NULL
        AND request.status = 'active' AND request.operator_topic_id = ?
        AND EXISTS (SELECT 1 FROM message_links AS link
          WHERE link.request_id = message.request_id AND link.direction = 'client_to_operator'
            AND link.client_message_id = message.external_message_id AND link.operator_message_id = ?)`,
      )
      .get(enrollmentId, operatorTopicId, operatorMessageId) as
      { request_id: string; text: string } | undefined;
    if (!message) {
      database.exec('COMMIT');
      return 'unavailable';
    }
    const key = `enrollment:${enrollmentId}`;
    const existing = database
      .prepare('SELECT status FROM deliveries WHERE idempotency_key = ?')
      .get(key) as { status: 'pending' | 'sent' | 'failed' } | undefined;
    if (existing) {
      database.exec('COMMIT');
      return existing.status;
    }
    const request = repository.findRequestById(message.request_id)!;
    repository.recordConversationMessage({
      id: randomUUID(),
      requestId: request.id,
      direction: 'operator_to_client',
      externalMessageId: operatorMessageId,
      createdAt: confirmedAt,
      text: message.text,
    });
    repository.recordUsageEvent({
      id: `first-reply:${request.id}`,
      requestId: request.id,
      channel: request.channel,
      type: 'first_reply',
      occurredAt: confirmedAt,
    });
    repository.enqueueDelivery({
      id: randomUUID(),
      requestId: request.id,
      channel: request.channel,
      conversationId: request.conversationId,
      operatorMessageId,
      idempotencyKey: key,
      createdAt: confirmedAt,
      text: message.text,
    });
    database.exec('COMMIT');
    return 'pending';
  } catch (error: unknown) {
    database.exec('ROLLBACK');
    throw error;
  }
}
