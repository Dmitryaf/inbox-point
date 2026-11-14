ALTER TABLE operator_actions RENAME TO operator_actions_v10;
      DROP INDEX IF EXISTS operator_actions_by_status;

  CREATE TABLE IF NOT EXISTS operator_actions (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES support_requests(id),
    kind TEXT NOT NULL CHECK (kind IN (
      'close_request',
      'mirror_operator_message',
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
      FROM operator_actions_v10;

      DROP TABLE operator_actions_v10;
