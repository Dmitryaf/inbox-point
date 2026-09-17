CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
  external_conversation_id TEXT NOT NULL,
  operator_topic_id TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS client_conversation_states (
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
  external_conversation_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state = 'awaiting_question'),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (channel, external_conversation_id)
) STRICT;

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES support_requests(id),
  direction TEXT NOT NULL CHECK (direction IN ('client_to_operator', 'operator_to_client')),
  external_message_id TEXT NOT NULL,
  sender_name TEXT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (request_id, direction, external_message_id)
) STRICT;

CREATE INDEX IF NOT EXISTS conversation_messages_by_request
  ON conversation_messages(request_id, created_at);

CREATE TABLE IF NOT EXISTS remembered_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS remembered_admin_sessions_by_expiry ON remembered_admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS operator_actions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES support_requests(id),
  kind TEXT NOT NULL CHECK (kind IN ('open_request', 'relay_message', 'close_request', 'reopen_request', 'mirror_operator_message')),
  client_message_id TEXT NOT NULL,
  operator_topic_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  initial INTEGER NOT NULL CHECK (initial IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'outcome_unknown', 'abandoned', 'superseded')),
  external_result_id TEXT,
  last_error TEXT,
  attempt_started_at TEXT,
  completed_at TEXT,
  manual_resolution TEXT CHECK (manual_resolution IN ('confirmed_received', 'use_web', 'completed', 'not_completed')),
  resolved_at TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS operator_actions_by_request ON operator_actions(request_id, client_message_id, sequence);
CREATE INDEX IF NOT EXISTS operator_actions_by_status ON operator_actions(status, created_at);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'new_request', 'information_section', 'first_reply', 'delivery_failure', 'web_takeover'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
  request_id TEXT,
  occurred_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS usage_events_by_time ON usage_events(occurred_at, event_type);

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

CREATE TABLE IF NOT EXISTS inbound_event_cursors (
  source TEXT PRIMARY KEY,
  cursor TEXT NOT NULL
) STRICT;
