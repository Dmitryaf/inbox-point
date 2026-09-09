export const sqliteSchemaVersion = 4;

export const requiredSqliteTables = [
  'conversation_messages',
  'deliveries',
  'inbound_events',
  'message_links',
  'operator_actions',
  'usage_events',
  'processed_events',
  'support_requests',
] as const;
