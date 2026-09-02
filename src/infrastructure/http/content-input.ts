import { z } from 'zod';

import {
  type ClientInformationContent,
  hasValidCustomSections,
  hasValidFaqItems,
} from '@/core/application/client-information.js';

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
  })
  .strict();

export function normalizeContentInput(
  content: z.infer<typeof contentInputSchema>,
): ClientInformationContent | undefined {
  const address = content.address.trim();
  const prices = content.prices.trim();
  const schedule = content.schedule.trim();
  const customSections = content.customSections
    .map((section) => ({
      label: section.label.trim(),
      text: section.text.trim(),
    }))
    .filter((section) => section.label || section.text);

  if (!hasValidCustomSections(customSections)) return undefined;
  const faq = content.faq
    .map((item) => ({
      answer: item.answer.trim(),
      question: item.question.trim(),
    }))
    .filter((item) => item.question || item.answer);
  if (!hasValidFaqItems(faq)) return undefined;

  return {
    ...(address ? { address } : {}),
    ...(customSections.length > 0 ? { customSections } : {}),
    ...(faq.length > 0 ? { faq } : {}),
    ...(prices ? { prices } : {}),
    ...(schedule ? { schedule } : {}),
  };
}
