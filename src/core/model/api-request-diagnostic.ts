import type { ClientChannelKind } from './support-message.js';

export interface ApiRequestDiagnostic {
  apiCode?: number;
  channel: ClientChannelKind;
  durationMs: number;
  httpStatus?: number;
  kind: 'transport' | 'http' | 'api' | 'invalid_response';
  method: string;
  operationId: string;
  transportCodes: readonly string[];
}
