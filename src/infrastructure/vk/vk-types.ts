import { z } from 'zod';

const vkMessageSchema = z.object({
  conversation_message_id: z.number().int().nonnegative().optional(),
  date: z.number().int().nonnegative(),
  from_id: z.number().int(),
  id: z.number().int().nonnegative(),
  out: z.number().int().optional(),
  peer_id: z.number().int(),
  text: z.string(),
});

export const vkLongPollEventSchema = z.object({
  event_id: z.string().optional(),
  group_id: z.number().int().positive(),
  object: z.object({
    message: vkMessageSchema,
  }),
  type: z.string(),
});

export type VkLongPollEvent = z.infer<typeof vkLongPollEventSchema>;
