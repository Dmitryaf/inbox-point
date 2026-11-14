CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_by_operator_event
    ON conversation_messages(request_id, event_source, external_event_id)
    WHERE event_source IS NOT NULL AND external_event_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_by_held_sequence
    ON conversation_messages(request_id, held_sequence)
    WHERE held_sequence IS NOT NULL;
  CREATE INDEX IF NOT EXISTS conversation_messages_by_prerequisite
    ON conversation_messages(prerequisite_action_id, processing_state);
