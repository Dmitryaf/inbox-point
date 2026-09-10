import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';

export function requestErrorMessage(
  cause: unknown,
  onUnauthorized: () => void,
): string {
  if (cause instanceof HttpError && cause.status === 401) {
    onUnauthorized();
    return '';
  }
  return errorMessage(cause);
}
