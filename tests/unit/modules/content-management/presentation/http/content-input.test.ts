import { describe, expect, it } from 'vitest';

import { formatScheduleResponse } from '@/core/application/client-information.js';
import { formatScheduleCompatibilityResponse } from '@/core/application/schedule-response.js';
import {
  contentInputSchema,
  normalizeContentInput,
} from '@/modules/content-management/presentation/http/content-input.js';

const visibleSections = ['schedule', 'prices', 'address', 'faq'] as const;

describe('normalizeContentInput', () => {
  it('trims schedule fields and removes fully empty items', () => {
    const normalized = normalizeContentInput({
      address: '',
      customSections: [],
      faq: [],
      prices: '',
      schedule: '',
      scheduleItems: [
        {
          dayTime: ' Вт / Чт, 19:00 ',
          description: ' Для начинающих. ',
          title: ' Бачата ',
        },
        { dayTime: ' ', description: '', title: '' },
      ],
      visibleSections: [...visibleSections],
    });

    expect(normalized?.schedule).toEqual([
      {
        dayTime: 'Вт / Чт, 19:00',
        description: 'Для начинающих.',
        title: 'Бачата',
      },
    ]);
  });

  it('rejects a partially filled schedule item', () => {
    expect(
      normalizeContentInput({
        address: '',
        customSections: [],
        faq: [],
        prices: '',
        schedule: '',
        scheduleItems: [{ dayTime: '', title: 'Бачата' }],
        visibleSections: [...visibleSections],
      }),
    ).toBeUndefined();
  });

  it('rejects line breaks in single-line schedule fields', () => {
    expect(
      contentInputSchema.safeParse({
        address: '',
        customSections: [],
        faq: [],
        prices: '',
        schedule: '',
        scheduleItems: [
          { dayTime: 'Вт\n19:00', title: 'Бачата\nдля начинающих' },
        ],
        visibleSections: [...visibleSections],
      }).success,
    ).toBe(false);
  });

  it('rejects content when schedule formatting exceeds the channel limit', () => {
    const schedule = Array.from({ length: 5 }, (_, index) => ({
      dayTime: `День ${index}`,
      description: 'a'.repeat(800),
      title: `Группа ${index}`,
    }));

    expect(
      normalizeContentInput({
        address: '',
        customSections: [],
        faq: [],
        prices: '',
        schedule: '',
        scheduleItems: schedule,
        visibleSections: [...visibleSections],
      }),
    ).toBeUndefined();
  });

  it('accepts a response at the compatibility-safe channel limit', () => {
    const schedule = Array.from({ length: 5 }, (_, index) => ({
      dayTime: `День ${index}`,
      description: 'a'.repeat(750),
      title: `Группа ${index}`,
    }));
    schedule[0]!.description += 'a'.repeat(
      4_000 - formatScheduleResponse(schedule).length,
    );
    const compatibilityOverflow =
      formatScheduleCompatibilityResponse(schedule).length - 4_000;
    schedule[0]!.description = schedule[0]!.description.slice(
      0,
      -compatibilityOverflow,
    );

    const normalized = normalizeContentInput({
      address: '',
      customSections: [],
      faq: [],
      prices: '',
      schedule: '',
      scheduleItems: schedule,
      visibleSections: [...visibleSections],
    });

    expect(normalized).toEqual({
      schedule,
      visibleSections: [...visibleSections],
    });
  });
});
