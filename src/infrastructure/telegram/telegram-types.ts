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
  animation: z.unknown().optional(),
  audio: z.unknown().optional(),
  chat: telegramChatSchema,
  contact: z.unknown().optional(),
  date: z.number().int(),
  dice: z.unknown().optional(),
  document: z.unknown().optional(),
  forum_topic_closed: z.object({}).optional(),
  forum_topic_reopened: z.object({}).optional(),
  from: telegramUserSchema.optional(),
  message_id: z.number().int(),
  message_thread_id: z.number().int().optional(),
  paid_media: z.unknown().optional(),
  photo: z.unknown().optional(),
  poll: z.unknown().optional(),
  sticker: z.unknown().optional(),
  story: z.unknown().optional(),
  text: z.string().optional(),
  venue: z.unknown().optional(),
  video: z.unknown().optional(),
  video_note: z.unknown().optional(),
  voice: z.unknown().optional(),
});

export const telegramUpdateSchema = z.object({
  message: telegramMessageSchema.optional(),
  update_id: z.number().int().nonnegative(),
});

export type TelegramMessage = z.infer<typeof telegramMessageSchema>;
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
