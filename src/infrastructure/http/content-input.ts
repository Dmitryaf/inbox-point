import { z } from 'zod';

import {
  type ClientInformationContent,
  hasValidCustomSections,
} from '@/core/application/client-information.js';

export const contentInputSchema = z.object({
  address: z.string().max(4_000),
  customSections: z
    .array(
      z.object({
        format: z.enum(['plain', 'faq']).default('plain'),
        label: z.string().max(40),
        text: z.string().max(4_000),
      }),
    )
    .max(6)
    .default([]),
  prices: z.string().max(4_000),
  schedule: z.string().max(4_000),
});

export function normalizeContentInput(
  content: z.infer<typeof contentInputSchema>,
): ClientInformationContent | undefined {
  const address = content.address.trim();
  const prices = content.prices.trim();
  const schedule = content.schedule.trim();
  const customSections = content.customSections
    .map((section) => ({
      ...(section.format === 'faq' ? { format: 'faq' as const } : {}),
      label: section.label.trim(),
      text: section.text.trim(),
    }))
    .filter((section) => section.label || section.text);

  if (!hasValidCustomSections(customSections)) return undefined;

  return {
    ...(address ? { address } : {}),
    ...(customSections.length > 0 ? { customSections } : {}),
    ...(prices ? { prices } : {}),
    ...(schedule ? { schedule } : {}),
  };
}
