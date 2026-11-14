CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN (
      'new_request', 'information_section', 'menu_action',
      'first_reply', 'delivery_failure', 'web_takeover'
    )),
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
    request_id TEXT,
    action_key TEXT,
    action_label TEXT,
    occurred_at TEXT NOT NULL,
    CHECK (event_type != 'menu_action' OR (
      action_key IS NOT NULL AND length(action_key) > 0 AND
      action_label IS NOT NULL AND length(action_label) > 0
    ))
  ) STRICT;
  CREATE INDEX IF NOT EXISTS usage_events_by_time
    ON usage_events(occurred_at, event_type);

      ALTER TABLE usage_events RENAME TO usage_events_v11;
      DROP INDEX IF EXISTS usage_events_by_time;

  CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN (
      'new_request', 'information_section', 'menu_action',
      'first_reply', 'delivery_failure', 'web_takeover'
    )),
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
    request_id TEXT,
    action_key TEXT,
    action_label TEXT,
    occurred_at TEXT NOT NULL,
    CHECK (event_type != 'menu_action' OR (
      action_key IS NOT NULL AND length(action_key) > 0 AND
      action_label IS NOT NULL AND length(action_label) > 0
    ))
  ) STRICT;
  CREATE INDEX IF NOT EXISTS usage_events_by_time
    ON usage_events(occurred_at, event_type);

      INSERT INTO usage_events (id, event_type, channel, request_id, occurred_at)
        SELECT id, event_type, channel, request_id, occurred_at FROM usage_events_v11;
      DROP TABLE usage_events_v11;
