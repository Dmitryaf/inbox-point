import type { DatabaseSync } from 'node:sqlite';

export function recoverInterruptedSqliteWork(database: DatabaseSync): void {
  releaseInterruptedEvents(database);
  markInterruptedDeliveriesUnknown(database);
  markInterruptedOperatorActionsUnknown(database);
}

function releaseInterruptedEvents(database: DatabaseSync): void {
  // One SQLite database is owned by one application process. A processing row
  // found during repository startup therefore belongs to an interrupted run.
  database
    .prepare("DELETE FROM processed_events WHERE status = 'processing'")
    .run();
}

function markInterruptedDeliveriesUnknown(database: DatabaseSync): void {
  database
    .prepare(
      `UPDATE deliveries
       SET status = 'failed',
           attempts = attempts + 1,
           last_error = 'Delivery was interrupted after the attempt started',
           outcome_unknown = 1,
           attempt_started_at = NULL
       WHERE status = 'pending' AND attempt_started_at IS NOT NULL`,
    )
    .run();
}

function markInterruptedOperatorActionsUnknown(database: DatabaseSync): void {
  database
    .prepare(
      `UPDATE operator_actions
       SET status = 'outcome_unknown',
           last_error = 'Operator action was interrupted after the attempt started',
           attempt_started_at = NULL
       WHERE status = 'sending'`,
    )
    .run();
}
