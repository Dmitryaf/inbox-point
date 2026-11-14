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

ALTER TABLE support_requests ADD COLUMN web_owned_at TEXT;

  ALTER TABLE operator_actions RENAME TO operator_actions_v7;
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
  FROM operator_actions_v7;

  DROP TABLE operator_actions_v7;

  CREATE TABLE IF NOT EXISTS client_conversation_states (
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
    external_conversation_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state = 'awaiting_question'),
    updated_at TEXT NOT NULL,
    application_label TEXT,
    question_context TEXT,
    class_enrollment INTEGER NOT NULL DEFAULT 0 CHECK (class_enrollment IN (0, 1)),
    enrollment_confirmation_text TEXT,
    PRIMARY KEY (channel, external_conversation_id)
  ) STRICT;

  CREATE TRIGGER IF NOT EXISTS clear_client_conversation_state_on_request
    AFTER INSERT ON support_requests
    BEGIN
      DELETE FROM client_conversation_states
      WHERE channel = NEW.channel
        AND external_conversation_id = NEW.external_conversation_id;
    END;
