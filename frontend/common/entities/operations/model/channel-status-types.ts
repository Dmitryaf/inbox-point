export type ConnectionSource = 'environment' | 'local' | 'none';

export interface ChannelOperationsStatus {
  consecutiveFailures?: number;
  lastRecoveredAt?: string;
  lastFailure?: {
    stage: 'startup' | 'poll';
    request?: {
      apiCode?: number;
      channel: 'telegram' | 'vk';
      durationMs: number;
      httpStatus?: number;
      kind: 'transport' | 'http' | 'api' | 'invalid_response';
      method: string;
      operationId: string;
      transportCodes: readonly string[];
    };
  };
  configured: boolean;
  lastFailedPollAt?: string;
  lastSuccessfulPollAt?: string;
  running: boolean;
  source: ConnectionSource;
  state:
    | 'configuration_missing'
    | 'not_configured'
    | 'poll_failed'
    | 'poll_stale'
    | 'running'
    | 'starting'
    | 'stopped';
}
