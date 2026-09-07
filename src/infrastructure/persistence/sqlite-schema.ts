export const sqliteSchemaVersion = 3;

export const requiredSqliteTables = [
  'conversation_messages',
  'deliveries',
  'inbound_events',
  'message_links',
  'usage_events',
  'processed_events',
  'support_requests',
] as const;
