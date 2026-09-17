import { z } from 'zod';

const vkMessageSchema = z.object({
  admin_author_id: z.number().int().positive().optional(),
  attachments: z.array(z.object({ type: z.string() }).passthrough()).optional(),
  conversation_message_id: z.number().int().nonnegative().optional(),
  date: z.number().int().nonnegative(),
  from_id: z.number().int(),
  id: z.number().int().nonnegative(),
  out: z.number().int().optional(),
  payload: z.string().optional(),
  peer_id: z.number().int(),
  random_id: z.number().int().optional(),
  text: z.string(),
});

export const vkLongPollEventSchema = z
  .object({
    event_id: z.string().optional(),
    group_id: z.number().int().positive(),
    object: z.record(z.string(), z.unknown()),
    type: z.string().min(1),
  })
  .passthrough();

export const vkMessageNewEventSchema = vkLongPollEventSchema.extend({
  object: z.object({
    message: vkMessageSchema,
  }),
  type: z.literal('message_new'),
});

export const vkMessageReplyEventSchema = vkLongPollEventSchema.extend({
  object: z
    .union([
      vkMessageSchema,
      z.object({
        message: vkMessageSchema,
      }),
    ])
    .transform((object) =>
      'message' in object ? object : { message: object },
    ),
  type: z.literal('message_reply'),
});

export const vkMessageEventSchema = z.union([
  vkMessageNewEventSchema,
  vkMessageReplyEventSchema,
]);

export type VkLongPollEvent = z.infer<typeof vkLongPollEventSchema>;
export type VkMessageNewEvent = z.infer<typeof vkMessageNewEventSchema>;
export type VkMessageReplyEvent = z.infer<typeof vkMessageReplyEventSchema>;
