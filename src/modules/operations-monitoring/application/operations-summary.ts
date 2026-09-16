export type OverallOperationsState = 'attention' | 'healthy' | 'maintenance';

export function mapOperatorInboxStatus(summary: {
  recoverable: number;
  webOwned: number;
}): {
  recoverableWebRequests: number;
  state: 'attention' | 'healthy';
  webOwnedRequests: number;
} {
  return {
    recoverableWebRequests: summary.recoverable,
    state: summary.recoverable > 0 ? 'attention' : 'healthy',
    webOwnedRequests: summary.webOwned,
  };
}

export function mapOperationsState(
  needsAttention: boolean,
  maintenance: boolean,
): OverallOperationsState {
  if (needsAttention) {
    return 'attention';
  }
  return maintenance ? 'maintenance' : 'healthy';
}

export function uptimeSeconds(startedAt: Date, observedAt: Date): number {
  return Math.max(
    0,
    Math.floor((observedAt.getTime() - startedAt.getTime()) / 1_000),
  );
}
