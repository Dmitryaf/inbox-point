import { z } from 'zod';
import { informationSectionIds } from '@/core/application/client-information.js';

const customSectionSchema = z.object({
  label: z.string().min(1).max(40),
  text: z.string().min(1).max(4_000),
});
const faqItemSchema = z.object({
  answer: z.string().min(1).max(3_000),
  question: z.string().min(1).max(300),
});
const visibleSectionsSchema = z
  .array(z.enum(informationSectionIds))
  .max(informationSectionIds.length)
  .refine((sections) => new Set(sections).size === sections.length);

export const contentPayloadSchema = z.object({
  address: z.string().min(1).max(4_000).optional(),
  customSections: z.array(customSectionSchema).max(6).optional(),
  faq: z.array(faqItemSchema).max(20).optional(),
  prices: z.string().min(1).max(4_000).optional(),
  schedule: z.string().min(1).max(4_000).optional(),
  visibleSections: visibleSectionsSchema.optional(),
});
const contentSectionSchema = z.enum([
  'schedule',
  'prices',
  'address',
  'faq',
  'customSections',
  'visibility',
]);
const historyEntrySchema = z.object({
  changedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  sections: z.array(contentSectionSchema).min(1).max(6),
});
const revisionSchema = historyEntrySchema.extend({
  content: contentPayloadSchema,
  revision: z.number().int().positive(),
});

export const storedContentSchema = z
  .object({
    content: contentPayloadSchema,
    history: z.array(revisionSchema).max(20),
  })
  .strict();

export type StoredContentData = z.infer<typeof storedContentSchema>;
export type ContentPayload = z.infer<typeof contentPayloadSchema>;
