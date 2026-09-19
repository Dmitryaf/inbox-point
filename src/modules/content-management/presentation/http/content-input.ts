import { z } from 'zod';

import {
  type ClientInformationContent,
  hasValidClientInformationResponses,
  hasValidCustomSections,
  hasValidFaqItems,
  hasValidScheduleItems,
  informationSectionIds,
  scheduleDayTimeLengthLimit,
  scheduleDescriptionLengthLimit,
  scheduleItemLimit,
  scheduleTitleLengthLimit,
} from '@/core/application/client-information.js';
import { formatScheduleCompatibilityText } from '@/core/application/schedule-response.js';

const visibleSectionsSchema = z
  .array(z.enum(informationSectionIds))
  .max(informationSectionIds.length)
  .refine((sections) => new Set(sections).size === sections.length)
  .default([...informationSectionIds]);

const scheduleItemSchema = z
  .object({
    dayTime: z
      .string()
      .max(scheduleDayTimeLengthLimit)
      .regex(/^[^\r\n]*$/u),
    description: z.string().max(scheduleDescriptionLengthLimit).optional(),
    title: z
      .string()
      .max(scheduleTitleLengthLimit)
      .regex(/^[^\r\n]*$/u),
  })
  .strict();

export const contentInputSchema = z
  .object({
    address: z.string().max(4_000),
    customSections: z
      .array(
        z
          .object({
            label: z.string().max(40),
            text: z.string().max(4_000),
          })
          .strict(),
      )
      .max(6)
      .default([]),
    faq: z
      .array(
        z
          .object({
            answer: z.string().max(3_000),
            question: z.string().max(300),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    prices: z.string().max(4_000),
    schedule: z.string().max(4_000),
    scheduleItems: z
      .array(scheduleItemSchema)
      .max(scheduleItemLimit)
      .optional(),
    visibleSections: visibleSectionsSchema,
  })
  .strict();

export function normalizeContentInput(
  content: z.infer<typeof contentInputSchema>,
  current: ClientInformationContent = {},
): ClientInformationContent | undefined {
  const address = content.address.trim();
  const prices = content.prices.trim();
  const legacySchedule = content.schedule;
  const submittedSchedule =
    content.scheduleItems?.map((item) => ({
      dayTime: item.dayTime.trim(),
      ...(item.description?.trim()
        ? { description: item.description.trim() }
        : {}),
      title: item.title.trim(),
    })) ?? [];
  const schedule =
    content.scheduleItems === undefined && current.schedule?.length
      ? current.schedule.map((item) => ({ ...item }))
      : submittedSchedule.filter(
          (item) => item.title || item.dayTime || item.description,
        );
  const customSections = content.customSections
    .map((section) => ({
      label: section.label.trim(),
      text: section.text.trim(),
    }))
    .filter((section) => section.label || section.text);

  if (!hasValidCustomSections(customSections)) {
    return undefined;
  }
  const faq = content.faq
    .map((item) => ({
      answer: item.answer.trim(),
      question: item.question.trim(),
    }))
    .filter((item) => item.question || item.answer);
  if (!hasValidFaqItems(faq)) {
    return undefined;
  }
  if (!hasValidScheduleItems(schedule)) {
    return undefined;
  }

  const normalized: ClientInformationContent = {
    ...(address ? { address } : {}),
    ...(customSections.length > 0 ? { customSections } : {}),
    ...(faq.length > 0 ? { faq } : {}),
    ...(prices ? { prices } : {}),
    ...(schedule.length > 0
      ? { schedule }
      : legacySchedule.trim()
        ? { legacySchedule }
        : {}),
    visibleSections: [...content.visibleSections],
  };

  if (!hasValidClientInformationResponses(normalized)) {
    return undefined;
  }

  return normalized;
}

export function hasLegacyScheduleConflict(
  content: z.infer<typeof contentInputSchema>,
  current: ClientInformationContent,
): boolean {
  return Boolean(
    content.scheduleItems === undefined &&
    current.schedule?.length &&
    content.schedule !== formatScheduleCompatibilityText(current.schedule),
  );
}
