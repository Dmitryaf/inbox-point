import { z } from 'zod';

import {
  telegramMessageSchema,
  telegramUpdateSchema,
  type TelegramMessage,
  type TelegramUpdate,
} from './telegram-types.js';

const apiEnvelopeSchema = z.object({
  description: z.string().optional(),
  ok: z.boolean(),
  result: z.unknown().optional(),
});

const forumTopicSchema = z.object({
  message_thread_id: z.number().int(),
  name: z.string(),
});

export interface GetUpdatesOptions {
  offset?: number;
  signal?: AbortSignal;
  timeoutSeconds: number;
}

export interface SendMessageOptions {
  chatId: number;
  messageThreadId?: number;
  signal?: AbortSignal;
  text: string;
}

export interface TelegramGateway {
  closeForumTopic(chatId: number, messageThreadId: number): Promise<void>;
  createForumTopic(chatId: number, name: string): Promise<{ topicId: number }>;
  getUpdates(options: GetUpdatesOptions): Promise<readonly TelegramUpdate[]>;
  reopenForumTopic(chatId: number, messageThreadId: number): Promise<void>;
  sendMessage(options: SendMessageOptions): Promise<{ messageId: number }>;
}

export class TelegramApiClient implements TelegramGateway {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;

  public constructor(token: string, fetchImplementation: typeof fetch = fetch) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.fetchImplementation = fetchImplementation;
  }

  public async closeForumTopic(
    chatId: number,
    messageThreadId: number,
  ): Promise<void> {
    await this.call(
      'closeForumTopic',
      { chat_id: chatId, message_thread_id: messageThreadId },
      z.literal(true),
    );
  }

  public async createForumTopic(
    chatId: number,
    name: string,
  ): Promise<{ topicId: number }> {
    const topic = await this.call(
      'createForumTopic',
      { chat_id: chatId, name },
      forumTopicSchema,
    );
    return { topicId: topic.message_thread_id };
  }

  public async getUpdates(
    options: GetUpdatesOptions,
  ): Promise<readonly TelegramUpdate[]> {
    return this.call(
      'getUpdates',
      {
        allowed_updates: ['message'],
        ...(options.offset === undefined ? {} : { offset: options.offset }),
        timeout: options.timeoutSeconds,
      },
      z.array(telegramUpdateSchema),
      options.signal,
    );
  }

  public async reopenForumTopic(
    chatId: number,
    messageThreadId: number,
  ): Promise<void> {
    await this.call(
      'reopenForumTopic',
      { chat_id: chatId, message_thread_id: messageThreadId },
      z.literal(true),
    );
  }

  public async sendMessage(
    options: SendMessageOptions,
  ): Promise<{ messageId: number }> {
    const message = await this.call<TelegramMessage>(
      'sendMessage',
      {
        chat_id: options.chatId,
        ...(options.messageThreadId === undefined
          ? {}
          : { message_thread_id: options.messageThreadId }),
        text: options.text,
      },
      telegramMessageSchema,
      options.signal,
    );
    return { messageId: message.message_id };
  }

  private async call<Result>(
    method: string,
    payload: Readonly<Record<string, unknown>>,
    resultSchema: z.ZodType<Result>,
    signal?: AbortSignal,
  ): Promise<Result> {
    let response: Response;
    try {
      response = await this.fetchImplementation(`${this.baseUrl}/${method}`, {
        body: JSON.stringify(payload),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        ...(signal ? { signal } : {}),
      });
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw error;
      }
      throw new Error(`Telegram API request failed for ${method}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(`Telegram API returned invalid JSON for ${method}`);
    }

    const envelope = apiEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
      throw new Error(
        `Telegram API returned an invalid response for ${method}`,
      );
    }
    if (!response.ok || !envelope.data.ok) {
      const description =
        envelope.data.description?.slice(0, 300) ?? 'request rejected';
      throw new Error(`Telegram API ${method} failed: ${description}`);
    }

    const result = resultSchema.safeParse(envelope.data.result);
    if (!result.success) {
      throw new Error(`Telegram API returned an invalid result for ${method}`);
    }
    return result.data;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
