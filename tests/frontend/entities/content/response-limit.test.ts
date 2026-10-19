import { expect, it } from 'vitest';
import { createEmptyContent } from '@frontend-common/entities/content/model/content-draft';
import {
  getCoreResponseLengths,
  findOversizedContentResponse,
} from '@frontend-common/entities/content/lib/content-response-limit';
it('counts the representation that can actually prevent saving', () => {
  const draft = createEmptyContent();
  draft.schedule = Array.from({ length: 4 }, () => ({
    title: 'Н'.repeat(120),
    dayTime: 'В'.repeat(120),
    description: 'О'.repeat(749),
  }));
  expect(getCoreResponseLengths(draft).schedule).toBe(4003);
  expect(findOversizedContentResponse(draft)?.label).toBe('Расписание');
  draft.schedule[0]!.description = 'О'.repeat(746);
  expect(getCoreResponseLengths(draft).schedule).toBe(4000);
  expect(findOversizedContentResponse(draft)).toBeUndefined();
});
