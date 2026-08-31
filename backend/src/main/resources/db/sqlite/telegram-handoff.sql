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
