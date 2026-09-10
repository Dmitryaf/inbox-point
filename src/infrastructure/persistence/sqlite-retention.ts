import type { DatabaseSync } from 'node:sqlite';

import type { RetentionCleanupResult } from '@/core/contracts/support-repository.js';

const eligibleRequestWhere = `request.status = 'closed'
  AND request.closed_at IS NOT NULL
  AND request.closed_at <= ?
  AND NOT EXISTS (
    SELECT 1
    FROM deliveries AS unfinished
    WHERE unfinished.request_id = request.id
      AND unfinished.status != 'sent'
  )`;

export function purgeClosedConversationContent(
  database: DatabaseSync,
  closedBefore: Date,
): RetentionCleanupResult {
  const cutoff = closedBefore.toISOString();
  const eligibleRequests = countRequests(
    database,
    eligibleRequestWhere,
    cutoff,
  );
  const skippedRequests = countRequests(
    database,
    `request.status = 'closed'
     AND request.closed_at IS NOT NULL
     AND request.closed_at <= ?
     AND EXISTS (
       SELECT 1
       FROM deliveries AS unfinished
       WHERE unfinished.request_id = request.id
         AND unfinished.status != 'sent'
     )`,
    cutoff,
  );

  database.exec('BEGIN IMMEDIATE');
  try {
    const messagesDeleted = database
      .prepare(
        `DELETE FROM conversation_messages
         WHERE request_id IN (
           SELECT request.id
           FROM support_requests AS request
           WHERE ${eligibleRequestWhere}
         )`,
      )
      .run(cutoff);
    const deliveriesRedacted = database
      .prepare(
        `UPDATE deliveries
         SET text = ''
         WHERE status = 'sent'
           AND text != ''
           AND request_id IN (
             SELECT request.id
             FROM support_requests AS request
             WHERE ${eligibleRequestWhere}
           )`,
      )
      .run(cutoff);
    const requestsAnonymized = database
      .prepare(
        `UPDATE support_requests AS request
         SET client_display_name = NULL
         WHERE client_display_name IS NOT NULL
           AND ${eligibleRequestWhere}`,
      )
      .run(cutoff);
    database.exec('COMMIT');

    return {
      deliveriesRedacted: Number(deliveriesRedacted.changes),
      eligibleRequests,
      messagesDeleted: Number(messagesDeleted.changes),
      requestsAnonymized: Number(requestsAnonymized.changes),
      skippedRequests,
    };
  } catch (error: unknown) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function countRequests(
  database: DatabaseSync,
  whereClause: string,
  cutoff: string,
): number {
  const row = database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM support_requests AS request
       WHERE ${whereClause}`,
    )
    .get(cutoff) as { count: number };

  return row.count;
}
