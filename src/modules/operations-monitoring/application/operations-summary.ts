export type OverallOperationsState = 'attention' | 'healthy' | 'maintenance';

export function mapOperatorInboxStatus(activeWebRequests: number): {
  activeWebRequests: number;
  state: 'attention' | 'healthy';
} {
  return {
    activeWebRequests,
    state: activeWebRequests > 0 ? 'attention' : 'healthy',
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
