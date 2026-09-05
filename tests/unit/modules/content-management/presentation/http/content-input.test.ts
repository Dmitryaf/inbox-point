import { describe, expect, it } from 'vitest';

import { normalizeContentInput } from '@/modules/content-management/presentation/http/content-input.js';

describe('normalizeContentInput', () => {
  it('rejects content when list formatting exceeds the channel limit', () => {
    const schedule = Array.from({ length: 2_000 }, () => 'a').join('\n');

    const normalized = normalizeContentInput({
      address: '',
      customSections: [],
      faq: [],
      prices: '',
      schedule,
      visibleSections: ['schedule', 'prices', 'address', 'faq'],
    });

    expect(schedule).toHaveLength(3_999);
    expect(normalized).toBeUndefined();
  });

  it('accepts a formatted response at the channel limit', () => {
    const schedule = 'a'.repeat(3_986);

    const normalized = normalizeContentInput({
      address: '',
      customSections: [],
      faq: [],
      prices: '',
      schedule,
      visibleSections: ['schedule', 'prices', 'address', 'faq'],
    });

    expect(normalized).toEqual({
      schedule,
      visibleSections: ['schedule', 'prices', 'address', 'faq'],
    });
  });
});
