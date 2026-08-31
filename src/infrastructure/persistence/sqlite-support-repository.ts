import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type {
  MessageLink,
  PendingDelivery,
  SupportRequest,
  SupportRequestStatus,
} from '@/core/model/support-request.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';

interface SupportRequestRow {
  channel: ClientChannelKind;
  closed_at: string | null;
  created_at: string;
  external_conversation_id: string;
  id: string;
  operator_topic_id: string;
  status: SupportRequestStatus;
}

export class SqliteSupportRepository implements SupportRepository {
  private readonly database: DatabaseSync;

  public constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.database = new DatabaseSync(path, {
      enableForeignKeyConstraints: true,
      timeout: 5_000,
    });
    this.database.exec('PRAGMA journal_mode = WAL');
    this.database.exec('PRAGMA synchronous = FULL');
    this.migrate();
  }

  public addMessageLink(link: MessageLink): void {
    this.database
      .prepare(
        `INSERT INTO message_links (
          id,
          request_id,
          direction,
          client_message_id,
          operator_message_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        link.id,
        link.requestId,
        link.direction,
        link.clientMessageId,
        link.operatorMessageId,
        link.createdAt.toISOString(),
      );
  }

  public claimEvent(
    source: string,
    externalEventId: string,
    claimedAt: Date,
  ): boolean {
    const result = this.database
      .prepare(
        `INSERT OR IGNORE INTO processed_events (
          source,
          external_event_id,
          claimed_at
        ) VALUES (?, ?, ?)`,
      )
      .run(source, externalEventId, claimedAt.toISOString());

    return Number(result.changes) === 1;
  }

  public close(): void {
    this.database.close();
  }

  public closeRequest(requestId: string, closedAt: Date): void {
    this.database
      .prepare(
        `UPDATE support_requests
         SET status = 'closed', closed_at = ?
         WHERE id = ?`,
      )
      .run(closedAt.toISOString(), requestId);
  }

  public createRequest(request: SupportRequest): void {
    this.database
      .prepare(
        `INSERT INTO support_requests (
          id,
          channel,
          external_conversation_id,
          operator_topic_id,
          status,
          created_at,
          closed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        request.id,
        request.channel,
        request.conversationId,
        request.operatorTopicId,
        request.status,
        request.createdAt.toISOString(),
        request.closedAt?.toISOString() ?? null,
      );
  }

  public enqueueDelivery(delivery: PendingDelivery): string {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO deliveries (
          id,
          request_id,
          idempotency_key,
          channel,
          external_conversation_id,
          text,
          reply_to_external_message_id,
          status,
          attempts,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
      )
      .run(
        delivery.id,
        delivery.requestId,
        delivery.idempotencyKey,
        delivery.channel,
        delivery.conversationId,
        delivery.text,
        delivery.replyToExternalMessageId ?? null,
        delivery.createdAt.toISOString(),
      );

    const row = this.database
      .prepare(
        `SELECT id
         FROM deliveries
         WHERE idempotency_key = ?`,
      )
      .get(delivery.idempotencyKey) as { id: string } | undefined;

    if (!row) {
      throw new Error('Failed to persist outbound delivery');
    }
    return row.id;
  }

  public findActiveRequest(
    channel: ClientChannelKind,
    conversationId: string,
  ): SupportRequest | undefined {
    const row = this.database
      .prepare(
        `SELECT
          id,
          channel,
          external_conversation_id,
          operator_topic_id,
          status,
          created_at,
          closed_at
        FROM support_requests
        WHERE channel = ?
          AND external_conversation_id = ?
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1`,
      )
      .get(channel, conversationId) as SupportRequestRow | undefined;

    return row ? mapRequest(row) : undefined;
  }

  public findRequestByTopicId(topicId: string): SupportRequest | undefined {
    const row = this.database
      .prepare(
        `SELECT
          id,
          channel,
          external_conversation_id,
          operator_topic_id,
          status,
          created_at,
          closed_at
        FROM support_requests
        WHERE operator_topic_id = ?`,
      )
      .get(topicId) as SupportRequestRow | undefined;

    return row ? mapRequest(row) : undefined;
  }

  public markDeliveryFailed(deliveryId: string, error: string): void {
    this.database
      .prepare(
        `UPDATE deliveries
         SET status = 'failed',
             attempts = attempts + 1,
             last_error = ?
         WHERE id = ?`,
      )
      .run(error, deliveryId);
  }

  public markDeliverySent(
    deliveryId: string,
    externalMessageId: string,
    sentAt: Date,
  ): void {
    this.database
      .prepare(
        `UPDATE deliveries
         SET status = 'sent',
             attempts = attempts + 1,
             external_message_id = ?,
             last_error = NULL,
             sent_at = ?
         WHERE id = ?`,
      )
      .run(externalMessageId, sentAt.toISOString(), deliveryId);
  }

  public releaseEvent(source: string, externalEventId: string): void {
    this.database
      .prepare(
        `DELETE FROM processed_events
         WHERE source = ? AND external_event_id = ?`,
      )
      .run(source, externalEventId);
  }

  public reopenRequest(requestId: string): void {
    this.database
      .prepare(
        `UPDATE support_requests
         SET status = 'active', closed_at = NULL
         WHERE id = ?`,
      )
      .run(requestId);
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS support_requests (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
        external_conversation_id TEXT NOT NULL,
        operator_topic_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
        created_at TEXT NOT NULL,
        closed_at TEXT
      ) STRICT;

      CREATE UNIQUE INDEX IF NOT EXISTS one_active_request_per_conversation
        ON support_requests(channel, external_conversation_id)
        WHERE status = 'active';

      CREATE TABLE IF NOT EXISTS message_links (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES support_requests(id),
        direction TEXT NOT NULL CHECK (
          direction IN ('client_to_operator', 'operator_to_client')
        ),
        client_message_id TEXT NOT NULL,
        operator_message_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS processed_events (
        source TEXT NOT NULL,
        external_event_id TEXT NOT NULL,
        claimed_at TEXT NOT NULL,
        PRIMARY KEY (source, external_event_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES support_requests(id),
        idempotency_key TEXT NOT NULL UNIQUE,
        channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
        external_conversation_id TEXT NOT NULL,
        text TEXT NOT NULL,
        reply_to_external_message_id TEXT,
        status TEXT NOT NULL CHECK (
          status IN ('pending', 'sent', 'failed')
        ),
        attempts INTEGER NOT NULL DEFAULT 0,
        external_message_id TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        sent_at TEXT
      ) STRICT;
    `);
  }
}

function mapRequest(row: SupportRequestRow): SupportRequest {
  return {
    channel: row.channel,
    ...(row.closed_at ? { closedAt: new Date(row.closed_at) } : {}),
    conversationId: row.external_conversation_id,
    createdAt: new Date(row.created_at),
    id: row.id,
    operatorTopicId: row.operator_topic_id,
    status: row.status,
  };
}
