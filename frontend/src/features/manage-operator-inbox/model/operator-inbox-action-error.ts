import { HttpError } from '@frontend/shared/api/http-client';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

export async function resolveOperatorInboxActionError(
  cause: unknown,
  onUnauthorized: () => void,
  refresh: () => Promise<string>,
): Promise<string> {
  const message = requestErrorMessage(cause, onUnauthorized);
  if (cause instanceof HttpError && cause.status === 409) {
    await refresh();
  }
  return message;
}
