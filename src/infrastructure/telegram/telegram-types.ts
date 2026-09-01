import { z } from 'zod';

const telegramUserSchema = z.object({
  first_name: z.string(),
  id: z.number().int(),
  is_bot: z.boolean(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

const telegramChatSchema = z.object({
  id: z.number().int(),
  type: z.enum(['private', 'group', 'supergroup', 'channel']),
});

export const telegramMessageSchema = z.object({
  chat: telegramChatSchema,
  date: z.number().int(),
  forum_topic_closed: z.object({}).optional(),
  forum_topic_reopened: z.object({}).optional(),
  from: telegramUserSchema.optional(),
  message_id: z.number().int(),
  message_thread_id: z.number().int().optional(),
  text: z.string().optional(),
});

export const telegramUpdateSchema = z.object({
  message: telegramMessageSchema.optional(),
  update_id: z.number().int().nonnegative(),
});

export type TelegramMessage = z.infer<typeof telegramMessageSchema>;
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
