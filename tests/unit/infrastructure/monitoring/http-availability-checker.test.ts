import { describe, expect, it, vi } from 'vitest';

import { HttpAvailabilityChecker } from '@/infrastructure/monitoring/http-availability-checker.js';

describe('HttpAvailabilityChecker', () => {
  it('rejects a non-successful readiness response', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    );
    const checker = new HttpAvailabilityChecker(
      new URL('https://example.test/ready'),
      5_000,
      fetchMock,
    );

    await expect(checker.check()).rejects.toThrow(
      'Readiness endpoint returned HTTP 503',
    );
  });
});
