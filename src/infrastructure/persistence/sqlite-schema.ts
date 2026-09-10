import type { DatabaseSync } from 'node:sqlite';

export const sqliteSchemaVersion = 5;

export const requiredSqliteTables = [
  'conversation_messages',
  'deliveries',
  'inbound_events',
  'message_links',
  'operator_actions',
  'usage_events',
  'processed_events',
  'support_requests',
] as const;

export function initializeSqliteSchema(database: DatabaseSync): void {
  let version = readSchemaVersion(database);
  const hasTables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1",
    )
    .get();

  if (hasTables !== undefined && version === 3) {
    migrateSchema(database, operatorActionsTableSql, 4);
    version = 4;
  }
  if (hasTables !== undefined && version === 4) {
    migrateSchema(database, inboundEventRetryMigrationSql, sqliteSchemaVersion);
    version = sqliteSchemaVersion;
  }
  if (hasTables !== undefined && version !== sqliteSchemaVersion) {
    throw new Error(
      `Unsupported SQLite schema version ${version}; expected ${sqliteSchemaVersion}`,
    );
  }

  database.exec(initialSchemaSql);
  database.exec(`PRAGMA user_version = ${sqliteSchemaVersion}`);
}

function readSchemaVersion(database: DatabaseSync): number {
  const row = database.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  return row.user_version;
}

function migrateSchema(
  database: DatabaseSync,
  migrationSql: string,
  nextVersion: number,
): void {
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec(migrationSql);
    database.exec(`PRAGMA user_version = ${nextVersion}`);
    database.exec('COMMIT');
  } catch (error: unknown) {
    database.exec('ROLLBACK');
    throw error;
  }
}

const inboundEventRetryMigrationSql = `
  ALTER TABLE inbound_events
    ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE inbound_events
    ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (
      status IN ('pending', 'quarantined')
    );
  ALTER TABLE inbound_events ADD COLUMN last_error TEXT;
  ALTER TABLE inbound_events ADD COLUMN next_attempt_at TEXT;
  CREATE INDEX inbound_events_by_status
    ON inbound_events(source, status, received_at);
`;

const operatorActionsTableSql = `
  CREATE TABLE IF NOT EXISTS operator_actions (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES support_requests(id),
    kind TEXT NOT NULL CHECK (kind IN ('open_request', 'relay_message')),
    client_message_id TEXT NOT NULL,
    operator_topic_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    initial INTEGER NOT NULL CHECK (initial IN (0, 1)),
    status TEXT NOT NULL CHECK (status IN (
      'pending',
      'sending',
      'sent',
      'failed',
      'outcome_unknown',
      'abandoned'
    )),
    external_result_id TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    attempt_started_at TEXT,
    completed_at TEXT,
    manual_resolution TEXT CHECK (
      manual_resolution IN ('confirmed_received', 'use_web')
    ),
    resolved_at TEXT
  ) STRICT;

  CREATE INDEX IF NOT EXISTS operator_actions_by_status
    ON operator_actions(status, created_at, id);
`;

const initialSchemaSql = `
  CREATE TABLE IF NOT EXISTS support_requests (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
    external_conversation_id TEXT NOT NULL,
    client_display_name TEXT,
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

  CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES support_requests(id),
    direction TEXT NOT NULL CHECK (
      direction IN ('client_to_operator', 'operator_to_client')
    ),
    external_message_id TEXT NOT NULL,
    sender_name TEXT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (request_id, direction, external_message_id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS conversation_messages_by_request
    ON conversation_messages(request_id, created_at, id);

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
    attempts INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
      status IN ('pending', 'quarantined')
    ),
    last_error TEXT,
    next_attempt_at TEXT,
    PRIMARY KEY (source, external_event_id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS inbound_events_by_status
    ON inbound_events(source, status, received_at);

  CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN (
      'new_request',
      'information_section',
      'first_reply',
      'delivery_failure',
      'web_takeover'
    )),
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
    request_id TEXT,
    occurred_at TEXT NOT NULL
  ) STRICT;

  CREATE INDEX IF NOT EXISTS usage_events_by_time
    ON usage_events(occurred_at, event_type);

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
    outcome_unknown INTEGER NOT NULL DEFAULT 0 CHECK (
      outcome_unknown IN (0, 1)
    ),
    manual_resolution TEXT CHECK (
      manual_resolution IN ('confirmed_received', 'confirmed_not_received')
    ),
    resolved_at TEXT,
    operator_notified_at TEXT,
    notification_next_attempt_at TEXT,
    attempt_started_at TEXT,
    sent_at TEXT
  ) STRICT;

  ${operatorActionsTableSql}
`;
