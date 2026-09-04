import { z } from 'zod';

const legacyCustomSectionSchema = z.object({
  format: z.literal('faq').optional(),
  label: z.string().min(1).max(40),
  text: z.string().min(1).max(4_000),
});
const customSectionSchema = z.object({
  label: z.string().min(1).max(40),
  text: z.string().min(1).max(4_000),
});
const faqItemSchema = z.object({
  answer: z.string().min(1).max(3_000),
  question: z.string().min(1).max(300),
});

export const legacyContentPayloadSchema = z.object({
  address: z.string().min(1).max(4_000).optional(),
  customSections: z.array(legacyCustomSectionSchema).max(6).optional(),
  prices: z.string().min(1).max(4_000).optional(),
  schedule: z.string().min(1).max(4_000).optional(),
});
export const contentPayloadSchema = z.object({
  address: z.string().min(1).max(4_000).optional(),
  customSections: z.array(customSectionSchema).max(6).optional(),
  faq: z.array(faqItemSchema).max(20).optional(),
  prices: z.string().min(1).max(4_000).optional(),
  schedule: z.string().min(1).max(4_000).optional(),
});
const contentSectionSchema = z.enum([
  'schedule',
  'prices',
  'address',
  'faq',
  'customSections',
]);
const historyEntrySchema = z.object({
  changedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  sections: z.array(contentSectionSchema).min(1).max(5),
});
const legacyHistoryEntrySchema = z.object({
  changedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  sections: z
    .array(z.enum(['schedule', 'prices', 'address', 'customSections']))
    .min(1)
    .max(4),
});
const revisionSchema = historyEntrySchema.extend({
  content: contentPayloadSchema,
  revision: z.number().int().positive(),
});

export const storedContentSchema = z.union([
  legacyContentPayloadSchema.extend({ version: z.literal(1) }),
  z.object({
    content: legacyContentPayloadSchema,
    history: z.array(legacyHistoryEntrySchema).max(20),
    version: z.literal(2),
  }),
  z.object({
    content: contentPayloadSchema,
    history: z.array(historyEntrySchema).max(20),
    version: z.literal(3),
  }),
  z.object({
    content: contentPayloadSchema,
    history: z.array(z.union([revisionSchema, historyEntrySchema])).max(20),
    version: z.literal(4),
  }),
]);

export const storedContentV4Schema = z.object({
  content: contentPayloadSchema,
  history: z.array(z.union([revisionSchema, historyEntrySchema])).max(20),
  version: z.literal(4),
});

export type StoredContentData = z.infer<typeof storedContentSchema>;
export type ContentPayload = z.infer<typeof contentPayloadSchema>;
export type LegacyContentPayload = z.infer<typeof legacyContentPayloadSchema>;
