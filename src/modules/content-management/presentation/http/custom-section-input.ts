import { z } from 'zod';

export const customSectionInputSchema = z
  .object({
    mode: z.enum(['information', 'application']).optional(),
    id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,80}$/u)
      .optional(),
    label: z.string().max(40),
    text: z.string().max(4_000),
  })
  .strict();
