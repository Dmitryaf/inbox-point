export const sqliteSchemaVersion = 1;

export const requiredSqliteTables = [
  'conversation_messages',
  'deliveries',
  'inbound_events',
  'message_links',
  'processed_events',
  'support_requests',
] as const;
