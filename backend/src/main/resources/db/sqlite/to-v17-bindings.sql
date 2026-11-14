CREATE TABLE IF NOT EXISTS channel_connection_identities (
    channel TEXT PRIMARY KEY CHECK (channel IN ('telegram', 'vk')),
    identity TEXT NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS operator_event_bindings (
    source TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    request_id TEXT NOT NULL REFERENCES support_requests(id),
    PRIMARY KEY (source, external_event_id)
  ) STRICT;

  INSERT OR IGNORE INTO operator_event_bindings (source, external_event_id, request_id)
    SELECT 'operator:telegram', client_message_id, request_id
    FROM operator_actions
    WHERE kind IN ('close_request', 'reopen_request')
      AND client_message_id != ''
      AND client_message_id NOT GLOB '*[^0-9]*'
    ORDER BY created_at, rowid;
  INSERT OR IGNORE INTO operator_event_bindings (source, external_event_id, request_id)
    SELECT event_source, external_event_id, request_id
    FROM conversation_messages
    WHERE event_source IS NOT NULL AND external_event_id IS NOT NULL
    ORDER BY created_at, rowid;
  INSERT OR IGNORE INTO operator_event_bindings (source, external_event_id, request_id)
    SELECT 'operator:telegram', substr(idempotency_key, 10), request_id
    FROM deliveries
    WHERE idempotency_key LIKE 'operator:%'
      AND substr(idempotency_key, 10) != ''
      AND substr(idempotency_key, 10) NOT GLOB '*[^0-9]*'
    ORDER BY created_at, rowid;
