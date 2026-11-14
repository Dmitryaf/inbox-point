CREATE TABLE IF NOT EXISTS remembered_admin_sessions (
    token_hash TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS remembered_admin_sessions_by_expiry
    ON remembered_admin_sessions(expires_at);
