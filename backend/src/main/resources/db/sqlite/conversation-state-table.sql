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
