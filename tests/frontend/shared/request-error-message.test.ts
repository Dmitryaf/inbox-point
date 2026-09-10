import { describe, expect, it, vi } from 'vitest';

import { HttpError } from '@frontend/shared/api/http-client';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

describe('requestErrorMessage', () => {
  it('expires the session without showing an error for an unauthorized request', () => {
    const onUnauthorized = vi.fn();

    const message = requestErrorMessage(
      new HttpError(401, 'Unauthorized'),
      onUnauthorized,
    );

    expect(message).toBe('');
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('returns the request message for other HTTP failures', () => {
    const onUnauthorized = vi.fn();

    const message = requestErrorMessage(
      new HttpError(500, 'Service unavailable'),
      onUnauthorized,
    );

    expect(message).toBe('Service unavailable');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
