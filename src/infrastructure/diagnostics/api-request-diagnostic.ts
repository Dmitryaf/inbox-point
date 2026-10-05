import type { ApiRequestDiagnostic } from '@/core/model/api-request-diagnostic.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';

const diagnostics = new WeakMap<Error, ApiRequestDiagnostic>();
export type ApiFailureObserver = (diagnostic: ApiRequestDiagnostic) => void;
const transportCodes = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  'ABORT_ERR',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_ABORTED',
  'UND_ERR_DESTROYED',
  'UND_ERR_PRX_TLS',
  'UND_ERR_PRX_CONN',
  'UND_ERR_CLOSED',
  'UND_ERR_HEADERS_OVERFLOW',
  'UND_ERR_RES_CONTENT_LENGTH_MISMATCH',
]);

export function safeTransportCodes(error: unknown): string[] {
  const found = new Set<string>();
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
  for (let inspected = 0; queue.length > 0 && inspected < 12; inspected++) {
    const item = queue.shift();
    if (!(item instanceof Error) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    const code = 'code' in item ? item.code : undefined;
    if (typeof code === 'string' && transportCodes.has(code)) {
      found.add(code);
    }
    if (item.name === 'TimeoutError') {
      found.add('ETIMEDOUT');
    }
    queue.push(item.cause);
    if (item instanceof AggregateError) {
      const nested: unknown[] = item.errors;
      queue.push(...nested.slice(0, 8));
    }
  }
  return [...found];
}

export function beginApiRequest(
  channel: ClientChannelKind,
  method: string,
  onFailure: ApiFailureObserver = () => undefined,
) {
  const startedAt = performance.now();
  const operationId = globalThis.crypto.randomUUID();
  return <T extends Error>(
    error: T,
    kind: ApiRequestDiagnostic['kind'],
    details: { apiCode?: number; httpStatus?: number; cause?: unknown } = {},
  ): T => {
    const diagnostic: ApiRequestDiagnostic = {
      channel,
      method,
      operationId,
      kind,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      transportCodes: safeTransportCodes(details.cause),
      ...(details.httpStatus === undefined
        ? {}
        : { httpStatus: details.httpStatus }),
      ...(details.apiCode === undefined ? {} : { apiCode: details.apiCode }),
    };
    diagnostics.set(error, diagnostic);
    try {
      onFailure({
        ...diagnostic,
        transportCodes: [...diagnostic.transportCodes],
      });
    } catch {
      // Diagnostic output must not alter delivery/fallback semantics.
    }
    return error;
  };
}

export function getApiRequestDiagnostic(
  error: unknown,
): ApiRequestDiagnostic | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const diagnostic = diagnostics.get(error);
  return diagnostic
    ? { ...diagnostic, transportCodes: [...diagnostic.transportCodes] }
    : undefined;
}

// Never serialize arbitrary exception messages, stacks, URLs or nested payloads.
export function serializeSafeError(error: unknown) {
  const diagnostic = getApiRequestDiagnostic(error);
  return diagnostic
    ? {
        type: 'ExternalApiError',
        message: 'External API request failed',
        stack: '',
        ...diagnostic,
      }
    : {
        type: 'Error',
        message: 'Operation failed',
        stack: '',
        transportCodes: safeTransportCodes(error),
      };
}
