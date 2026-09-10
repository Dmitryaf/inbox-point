import { describe, expect, it } from 'vitest';

import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';

describe('errorMessage', () => {
  it('keeps a prepared server message', () => {
    expect(errorMessage(new HttpError(400, 'Проверьте токен и группу.'))).toBe(
      'Проверьте токен и группу.',
    );
  });

  it('hides raw browser and implementation errors', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe(
      'Не удалось выполнить действие. Проверьте подключение и попробуйте ещё раз.',
    );
  });
});
