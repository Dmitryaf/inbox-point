import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type {
  DeliverySummary,
  PendingInboundEvent,
  SupportRepository,
} from '@/core/contracts/support-repository.js';
import type {
  FailedDelivery,
  MessageLink,
  PendingDelivery,
  QueuedDelivery,
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

interface DeliveryRow {
  attempts: number;
  channel: ClientChannelKind;
  created_at: string;
  external_conversation_id: string;
  id: string;
  idempotency_key: string;
  operator_message_id: string | null;
  reply_to_external_message_id: string | null;
  request_id: string;
  text: string;
}

interface FailedDeliveryRow {
  attempts: number;
  channel: ClientChannelKind;
  created_at: string;
  id: string;
  last_error: string | null;
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
    this.releaseInterruptedEvents();
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
          claimed_at,
          status,
          completed_at
        ) VALUES (?, ?, ?, 'processing', NULL)`,
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

  public completeEvent(
    source: string,
    externalEventId: string,
    completedAt: Date,
  ): void {
    const result = this.database
      .prepare(
        `UPDATE processed_events
         SET status = 'completed', completed_at = ?
         WHERE source = ?
           AND external_event_id = ?
           AND status = 'processing'`,
      )
      .run(completedAt.toISOString(), source, externalEventId);

    if (Number(result.changes) !== 1) {
      throw new Error('Claimed event was not found');
    }
  }

  public completeInboundEvent(source: string, externalEventId: string): void {
    this.database
      .prepare(
        `DELETE FROM inbound_events
         WHERE source = ? AND external_event_id = ?`,
      )
      .run(source, externalEventId);
  }

  public completeDelivery(
    deliveryId: string,
    externalMessageId: string,
    sentAt: Date,
    link: MessageLink,
  ): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = this.database
        .prepare(
          `UPDATE deliveries
           SET status = 'sent',
               attempts = attempts + 1,
               external_message_id = ?,
               last_error = NULL,
               sent_at = ?
           WHERE id = ? AND status = 'pending'`,
        )
        .run(externalMessageId, sentAt.toISOString(), deliveryId);
      if (Number(result.changes) !== 1) {
        throw new Error('Pending delivery was not found');
      }
      this.addMessageLink(link);
      this.database.exec('COMMIT');
    } catch (error: unknown) {
      this.database.exec('ROLLBACK');
      throw error;
    }
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
          operator_message_id,
          channel,
          external_conversation_id,
          text,
          reply_to_external_message_id,
          status,
          attempts,
          created_at,
          next_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      )
      .run(
        delivery.id,
        delivery.requestId,
        delivery.idempotencyKey,
        delivery.operatorMessageId,
        delivery.channel,
        delivery.conversationId,
        delivery.text,
        delivery.replyToExternalMessageId ?? null,
        delivery.createdAt.toISOString(),
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

  public enqueueInboundEvents(events: readonly PendingInboundEvent[]): void {
    if (events.length === 0) {
      return;
    }

    const insert = this.database.prepare(
      `INSERT OR IGNORE INTO inbound_events (
        source,
        external_event_id,
        payload,
        received_at
      ) VALUES (?, ?, ?, ?)`,
    );
    this.database.exec('BEGIN IMMEDIATE');
    try {
      for (const event of events) {
        insert.run(
          event.source,
          event.externalEventId,
          event.payload,
          event.receivedAt.toISOString(),
        );
      }
      this.database.exec('COMMIT');
    } catch (error: unknown) {
      this.database.exec('ROLLBACK');
      throw error;
    }
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

  public findFailedDeliveries(limit: number): readonly FailedDelivery[] {
    const rows = this.database
      .prepare(
        `SELECT id, channel, attempts, last_error, created_at
         FROM deliveries
         WHERE status = 'failed'
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(limit) as unknown as FailedDeliveryRow[];

    return rows.map((row) => ({
      attempts: row.attempts,
      channel: row.channel,
      createdAt: new Date(row.created_at),
      id: row.id,
      lastError: row.last_error ?? 'Unknown delivery error',
    }));
  }

  public findLatestRequest(
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
        ORDER BY created_at DESC
        LIMIT 1`,
      )
      .get(channel, conversationId) as SupportRequestRow | undefined;

    return row ? mapRequest(row) : undefined;
  }

  public findPendingInboundEvents(
    source: string,
    limit: number,
  ): readonly PendingInboundEvent[] {
    const rows = this.database
      .prepare(
        `SELECT source, external_event_id, payload, received_at
         FROM inbound_events
         WHERE source = ?
         ORDER BY received_at, rowid
         LIMIT ?`,
      )
      .all(source, limit) as unknown as {
      external_event_id: string;
      payload: string;
      received_at: string;
      source: string;
    }[];

    return rows.map((row) => ({
      externalEventId: row.external_event_id,
      payload: row.payload,
      receivedAt: new Date(row.received_at),
      source: row.source,
    }));
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

  public getDeliverySummary(): DeliverySummary {
    const row = this.database
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
         FROM deliveries`,
      )
      .get() as { failed: number | null; pending: number | null };

    return {
      failed: row.failed ?? 0,
      pending: row.pending ?? 0,
    };
  }

  public findPendingDeliveries(
    availableBefore: Date,
    limit: number,
  ): readonly QueuedDelivery[] {
    const rows = this.database
      .prepare(
        `SELECT delivery.id, delivery.request_id, delivery.idempotency_key,
          delivery.operator_message_id, delivery.channel,
          delivery.external_conversation_id, delivery.text,
          delivery.reply_to_external_message_id, delivery.attempts,
          delivery.created_at
         FROM deliveries AS delivery
         WHERE delivery.status = 'pending'
           AND COALESCE(delivery.next_attempt_at, delivery.created_at) <= ?
           AND NOT EXISTS (
             SELECT 1
             FROM deliveries AS earlier
             WHERE earlier.status = 'pending'
               AND earlier.channel = delivery.channel
               AND earlier.external_conversation_id =
                 delivery.external_conversation_id
               AND (
                 earlier.created_at < delivery.created_at
                 OR (
                   earlier.created_at = delivery.created_at
                   AND earlier.rowid < delivery.rowid
                 )
               )
           )
         ORDER BY delivery.created_at, delivery.rowid
         LIMIT ?`,
      )
      .all(availableBefore.toISOString(), limit) as unknown as DeliveryRow[];

    return rows.map((row) => ({
      attempts: row.attempts,
      channel: row.channel,
      conversationId: row.external_conversation_id,
      createdAt: new Date(row.created_at),
      id: row.id,
      idempotencyKey: row.idempotency_key,
      operatorMessageId: row.operator_message_id ?? row.idempotency_key,
      ...(row.reply_to_external_message_id
        ? { replyToExternalMessageId: row.reply_to_external_message_id }
        : {}),
      requestId: row.request_id,
      text: row.text,
    }));
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

  public markDeliveryRetry(
    deliveryId: string,
    error: string,
    nextAttemptAt: Date,
  ): void {
    this.database
      .prepare(
        `UPDATE deliveries
         SET attempts = attempts + 1,
             last_error = ?,
             next_attempt_at = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(error, nextAttemptAt.toISOString(), deliveryId);
  }

  public releaseEvent(source: string, externalEventId: string): void {
    this.database
      .prepare(
        `DELETE FROM processed_events
         WHERE source = ?
           AND external_event_id = ?
           AND status = 'processing'`,
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

  public retryFailedDelivery(deliveryId: string, retryAt: Date): boolean {
    const result = this.database
      .prepare(
        `UPDATE deliveries
         SET status = 'pending',
             attempts = 0,
             external_message_id = NULL,
             last_error = NULL,
             next_attempt_at = ?,
             sent_at = NULL
         WHERE id = ? AND status = 'failed'`,
      )
      .run(retryAt.toISOString(), deliveryId);

    return Number(result.changes) === 1;
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
        status TEXT NOT NULL DEFAULT 'processing' CHECK (
          status IN ('processing', 'completed')
        ),
        completed_at TEXT,
        PRIMARY KEY (source, external_event_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS inbound_events (
        source TEXT NOT NULL,
        external_event_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        received_at TEXT NOT NULL,
        PRIMARY KEY (source, external_event_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES support_requests(id),
        idempotency_key TEXT NOT NULL UNIQUE,
        operator_message_id TEXT,
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
        next_attempt_at TEXT,
        sent_at TEXT
      ) STRICT;
    `);

    const deliveryColumns = this.database
      .prepare('PRAGMA table_info(deliveries)')
      .all() as unknown as { name: string }[];
    if (
      !deliveryColumns.some((column) => column.name === 'operator_message_id')
    ) {
      this.database.exec(
        'ALTER TABLE deliveries ADD COLUMN operator_message_id TEXT',
      );
    }
    if (!deliveryColumns.some((column) => column.name === 'next_attempt_at')) {
      this.database.exec(
        'ALTER TABLE deliveries ADD COLUMN next_attempt_at TEXT',
      );
    }

    const eventColumns = this.database
      .prepare('PRAGMA table_info(processed_events)')
      .all() as unknown as { name: string }[];
    if (!eventColumns.some((column) => column.name === 'status')) {
      this.database.exec(
        "ALTER TABLE processed_events ADD COLUMN status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed'))",
      );
    }
    if (!eventColumns.some((column) => column.name === 'completed_at')) {
      this.database.exec(
        'ALTER TABLE processed_events ADD COLUMN completed_at TEXT',
      );
    }
  }

  private releaseInterruptedEvents(): void {
    // One SQLite database is owned by one application process. A processing row
    // found during repository startup therefore belongs to an interrupted run.
    this.database
      .prepare("DELETE FROM processed_events WHERE status = 'processing'")
      .run();
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
