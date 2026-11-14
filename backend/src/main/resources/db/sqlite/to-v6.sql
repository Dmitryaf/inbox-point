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
