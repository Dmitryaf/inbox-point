import {
  copyClassContent,
  type ClassContent,
} from '@/core/application/class-content.js';
import { z } from 'zod';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,36}$/u);
const name = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[^\r\n/:]+$/u);
export const classContentShape = {
  directions: z.array(z.object({ id, name }).strict()).max(20).optional(),
  groups: z
    .array(
      z
        .object({
          id,
          directionId: z.union([id, z.literal('')]),
          name: z
            .string()
            .trim()
            .max(80)
            .regex(/^[^\r\n/:]*$/u),
          review: z
            .object({ source: z.string().min(1).max(6000) })
            .strict()
            .optional(),
          meetings: z
            .array(
              z
                .string()
                .trim()
                .min(1)
                .max(120)
                .regex(/^[^\r\n]+$/u),
            )
            .max(7),
          description: z.string().trim().max(1000),
          enrollmentOpen: z.boolean(),
          applicationQuestion: z.string().trim().max(1000),
        })
        .strict(),
    )
    .max(81)
    .optional(),
  keywords: z
    .array(
      z
        .object({
          phrase: z.string().trim().min(1).max(80),
          targetType: z.enum(['direction', 'group']),
          targetId: id,
        })
        .strict(),
    )
    .max(40)
    .optional(),
};

export function mergeClassInput(
  input: ClassContent,
  current: ClassContent,
): ReturnType<typeof copyClassContent> {
  return copyClassContent({
    directions: input.directions ?? current.directions,
    groups: input.groups ?? current.groups,
    keywords: input.keywords ?? current.keywords,
  });
}
