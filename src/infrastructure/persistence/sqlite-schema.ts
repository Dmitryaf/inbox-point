export const sqliteSchemaVersion = 2;

export const requiredSqliteTables = [
  'conversation_messages',
  'deliveries',
  'inbound_events',
  'message_links',
  'pilot_events',
  'processed_events',
  'support_requests',
] as const;
