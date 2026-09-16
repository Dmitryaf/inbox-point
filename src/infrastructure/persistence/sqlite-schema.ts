import type { DatabaseSync } from 'node:sqlite';

export const sqliteSchemaVersion = 10;

export const requiredSqliteTables = [
  'client_conversation_states',
  'conversation_messages',
  'deliveries',
  'inbound_event_cursors',
  'inbound_events',
  'message_links',
  'operator_actions',
  'remembered_admin_sessions',
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
    migrateSchema(database, inboundEventRetryMigrationSql, 5);
    version = 5;
  }
  if (hasTables !== undefined && version === 5) {
    migrateSupportRequestsForTopicReuse(database);
    version = 6;
  }
  if (hasTables !== undefined && version === 6) {
    migrateSchema(database, rememberedAdminSessionsTableSql, 7);
    version = 7;
  }
  if (hasTables !== undefined && version === 7) {
    database.exec(operatorActionsTableSql);
    migrateSchema(database, schemaEightMigrationSql, 8);
    version = 8;
  }
  if (hasTables !== undefined && version === 8) {
    migrateConversationMessagesForHeldReplies(database);
    version = 9;
  }
  if (hasTables !== undefined && version === 9) {
    migrateSchemaNine(database);
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

function migrateSupportRequestsForTopicReuse(database: DatabaseSync): void {
  database.exec('PRAGMA foreign_keys = OFF');
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec(`
      CREATE TABLE support_requests_v6 (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
        external_conversation_id TEXT NOT NULL,
        client_display_name TEXT,
        operator_topic_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
        created_at TEXT NOT NULL,
        closed_at TEXT
      ) STRICT;

      INSERT INTO support_requests_v6 (
        id,
        channel,
        external_conversation_id,
        client_display_name,
        operator_topic_id,
        status,
        created_at,
        closed_at
      )
      SELECT
        id,
        channel,
        external_conversation_id,
        client_display_name,
        operator_topic_id,
        status,
        created_at,
        closed_at
      FROM support_requests;

      DROP TABLE support_requests;
      ALTER TABLE support_requests_v6 RENAME TO support_requests;
      ${supportRequestIndexesAndTriggersSql}
      PRAGMA user_version = 6;
    `);

    const foreignKeyViolations = database
      .prepare('PRAGMA foreign_key_check')
      .all();
    if (foreignKeyViolations.length > 0) {
      throw new Error('SQLite topic reuse migration violated foreign keys');
    }
    database.exec('COMMIT');
  } catch (error: unknown) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.exec('PRAGMA foreign_keys = ON');
  }
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

function migrateConversationMessagesForHeldReplies(
  database: DatabaseSync,
): void {
  database.exec('BEGIN IMMEDIATE');
  try {
    const columns = new Set(
      (
        database.prepare('PRAGMA table_info(conversation_messages)').all() as {
          name: string;
        }[]
      ).map((column) => column.name),
    );
    if (!columns.has('processing_state')) {
      database.exec(`ALTER TABLE conversation_messages
        ADD COLUMN processing_state TEXT NOT NULL DEFAULT 'accepted' CHECK (
          processing_state IN ('accepted', 'held')
        )`);
    }
    if (!columns.has('event_source')) {
      database.exec(
        'ALTER TABLE conversation_messages ADD COLUMN event_source TEXT',
      );
    }
    if (!columns.has('external_event_id')) {
      database.exec(
        'ALTER TABLE conversation_messages ADD COLUMN external_event_id TEXT',
      );
    }
    if (!columns.has('prerequisite_action_id')) {
      database.exec(
        'ALTER TABLE conversation_messages ADD COLUMN prerequisite_action_id TEXT',
      );
    }
    if (!columns.has('held_sequence')) {
      database.exec(`ALTER TABLE conversation_messages
        ADD COLUMN held_sequence INTEGER CHECK (held_sequence >= 0)`);
    }
    database.exec(schemaNineIndexesSql);
    database.exec('PRAGMA user_version = 9');
    database.exec('COMMIT');
  } catch (error: unknown) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function migrateSchemaNine(database: DatabaseSync): void {
  database.exec(operatorActionsTableSql);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec(`
      ALTER TABLE operator_actions RENAME TO operator_actions_v9;
      DROP INDEX IF EXISTS operator_actions_by_status;
      ${operatorActionsTableSql}

      INSERT INTO operator_actions (
        id,
        request_id,
        kind,
        client_message_id,
        operator_topic_id,
        sequence,
        initial,
        status,
        external_result_id,
        last_error,
        created_at,
        attempt_started_at,
        completed_at,
        manual_resolution,
        resolved_at
      )
      SELECT
        id,
        request_id,
        kind,
        client_message_id,
        operator_topic_id,
        sequence,
        initial,
        status,
        external_result_id,
        last_error,
        created_at,
        attempt_started_at,
        completed_at,
        manual_resolution,
        resolved_at
      FROM operator_actions_v9;

      DROP TABLE operator_actions_v9;
      UPDATE operator_actions AS action
      SET status = 'superseded',
          attempt_started_at = NULL,
          manual_resolution = NULL,
          resolved_at = COALESCE(
            resolved_at,
            (
              SELECT MIN(newer.created_at)
              FROM support_requests AS current_request
              JOIN support_requests AS newer
                ON newer.channel = current_request.channel
               AND newer.external_conversation_id =
                 current_request.external_conversation_id
               AND newer.rowid > current_request.rowid
              WHERE current_request.id = action.request_id
                AND current_request.status = 'closed'
            )
          )
      WHERE status IN ('pending', 'sending', 'failed', 'outcome_unknown')
        AND EXISTS (
          SELECT 1
          FROM support_requests AS current_request
          JOIN support_requests AS newer
            ON newer.channel = current_request.channel
           AND newer.external_conversation_id =
             current_request.external_conversation_id
           AND newer.rowid > current_request.rowid
          WHERE current_request.id = action.request_id
            AND current_request.status = 'closed'
        );
      ${inboundEventCursorTableSql}
      PRAGMA user_version = 10;
    `);
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
    kind TEXT NOT NULL CHECK (kind IN (
      'close_request',
      'open_request',
      'relay_message',
      'reopen_request'
    )),
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
      'abandoned',
      'superseded'
    )),
    external_result_id TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    attempt_started_at TEXT,
    completed_at TEXT,
    manual_resolution TEXT CHECK (
      manual_resolution IN (
        'confirmed_completed',
        'confirmed_not_completed',
        'confirmed_received',
        'use_web'
      )
    ),
    resolved_at TEXT
  ) STRICT;

  CREATE INDEX IF NOT EXISTS operator_actions_by_status
    ON operator_actions(status, created_at, id);
`;

const rememberedAdminSessionsTableSql = `
  CREATE TABLE IF NOT EXISTS remembered_admin_sessions (
    token_hash TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS remembered_admin_sessions_by_expiry
    ON remembered_admin_sessions(expires_at);
`;

const inboundEventCursorTableSql = `
  CREATE TABLE IF NOT EXISTS inbound_event_cursors (
    source TEXT PRIMARY KEY,
    cursor TEXT NOT NULL
  ) STRICT;
`;

const clientConversationStateTableSql = `
  CREATE TABLE IF NOT EXISTS client_conversation_states (
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
    external_conversation_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state = 'awaiting_question'),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (channel, external_conversation_id)
  ) STRICT;

  CREATE TRIGGER IF NOT EXISTS clear_client_conversation_state_on_request
    AFTER INSERT ON support_requests
    BEGIN
      DELETE FROM client_conversation_states
      WHERE channel = NEW.channel
        AND external_conversation_id = NEW.external_conversation_id;
    END;
`;

const schemaEightMigrationSql = `
  ALTER TABLE support_requests ADD COLUMN web_owned_at TEXT;

  ALTER TABLE operator_actions RENAME TO operator_actions_v7;
  DROP INDEX IF EXISTS operator_actions_by_status;
  ${operatorActionsTableSql}

  INSERT INTO operator_actions (
    id,
    request_id,
    kind,
    client_message_id,
    operator_topic_id,
    sequence,
    initial,
    status,
    external_result_id,
    last_error,
    created_at,
    attempt_started_at,
    completed_at,
    manual_resolution,
    resolved_at
  )
  SELECT
    id,
    request_id,
    kind,
    client_message_id,
    operator_topic_id,
    sequence,
    initial,
    status,
    external_result_id,
    last_error,
    created_at,
    attempt_started_at,
    completed_at,
    manual_resolution,
    resolved_at
  FROM operator_actions_v7;

  DROP TABLE operator_actions_v7;
  ${clientConversationStateTableSql}
`;

const schemaNineIndexesSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_by_operator_event
    ON conversation_messages(request_id, event_source, external_event_id)
    WHERE event_source IS NOT NULL AND external_event_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_by_held_sequence
    ON conversation_messages(request_id, held_sequence)
    WHERE held_sequence IS NOT NULL;
  CREATE INDEX IF NOT EXISTS conversation_messages_by_prerequisite
    ON conversation_messages(prerequisite_action_id, processing_state);
`;

const supportRequestIndexesAndTriggersSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS one_active_request_per_conversation
    ON support_requests(channel, external_conversation_id)
    WHERE status = 'active';

  CREATE INDEX IF NOT EXISTS support_requests_by_operator_topic
    ON support_requests(operator_topic_id, status, created_at);

  CREATE TRIGGER IF NOT EXISTS operator_topic_conversation_insert
    BEFORE INSERT ON support_requests
    WHEN EXISTS (
      SELECT 1
      FROM support_requests
      WHERE operator_topic_id = NEW.operator_topic_id
        AND (
          channel <> NEW.channel
          OR external_conversation_id <> NEW.external_conversation_id
        )
    )
    BEGIN
      SELECT RAISE(ABORT, 'operator topic belongs to another conversation');
    END;

  CREATE TRIGGER IF NOT EXISTS operator_topic_conversation_update
    BEFORE UPDATE OF operator_topic_id, channel, external_conversation_id
      ON support_requests
    WHEN EXISTS (
      SELECT 1
      FROM support_requests
      WHERE operator_topic_id = NEW.operator_topic_id
        AND id <> NEW.id
        AND (
          channel <> NEW.channel
          OR external_conversation_id <> NEW.external_conversation_id
        )
    )
    BEGIN
      SELECT RAISE(ABORT, 'operator topic belongs to another conversation');
    END;
`;

const initialSchemaSql = `
  CREATE TABLE IF NOT EXISTS support_requests (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
    external_conversation_id TEXT NOT NULL,
    client_display_name TEXT,
    operator_topic_id TEXT NOT NULL,
    web_owned_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
    created_at TEXT NOT NULL,
    closed_at TEXT
  ) STRICT;

  ${supportRequestIndexesAndTriggersSql}
  ${clientConversationStateTableSql}

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
    processing_state TEXT NOT NULL DEFAULT 'accepted' CHECK (
      processing_state IN ('accepted', 'held')
    ),
    event_source TEXT,
    external_event_id TEXT,
    prerequisite_action_id TEXT,
    held_sequence INTEGER CHECK (held_sequence >= 0),
    UNIQUE (request_id, direction, external_message_id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS conversation_messages_by_request
    ON conversation_messages(request_id, created_at, id);

  CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_by_operator_event
    ON conversation_messages(request_id, event_source, external_event_id)
    WHERE event_source IS NOT NULL AND external_event_id IS NOT NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_by_held_sequence
    ON conversation_messages(request_id, held_sequence)
    WHERE held_sequence IS NOT NULL;

  CREATE INDEX IF NOT EXISTS conversation_messages_by_prerequisite
    ON conversation_messages(prerequisite_action_id, processing_state);

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

  ${inboundEventCursorTableSql}

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
  ${rememberedAdminSessionsTableSql}
`;
