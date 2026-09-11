import { describe, expect, it, vi } from 'vitest';

import { HttpError, request } from '@frontend/shared/api/http-client';
import { response } from '@test/frontend/support/fake-response';

describe('HTTP client', () => {
  it('does not describe a bodyless DELETE request as JSON', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(response({ connected: false })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await request('/api/setup/vk', { method: 'DELETE' });

    expect(fetchMock).toHaveBeenCalledWith('/api/setup/vk', {
      credentials: 'same-origin',
      method: 'DELETE',
    });
  });

  it('does not expose a framework error as user-facing text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          response(
            {
              code: 'FST_ERR_CTP_EMPTY_JSON_BODY',
              error: 'Bad Request',
              message:
                "Body cannot be empty when content-type is set to 'application/json'",
              statusCode: 400,
            },
            400,
          ),
        ),
      ),
    );

    await expect(
      request('/api/setup/vk', { method: 'DELETE' }),
    ).rejects.toEqual(new HttpError(400, 'Не удалось выполнить запрос.'));
  });
});
