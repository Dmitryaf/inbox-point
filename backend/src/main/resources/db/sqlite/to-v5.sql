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
