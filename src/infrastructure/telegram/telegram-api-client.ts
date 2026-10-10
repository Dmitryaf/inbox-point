import { z } from 'zod';

import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import {
  beginApiRequest,
  type ApiFailureObserver,
} from '@/infrastructure/diagnostics/api-request-diagnostic.js';
import {
  telegramMessageSchema,
  telegramUpdateSchema,
  type TelegramMessage,
  type TelegramUpdate,
} from './telegram-types.js';

const apiEnvelopeSchema = z.object({
  error_code: z.number().int().optional(),
  description: z.string().optional(),
  ok: z.boolean(),
  result: z.unknown().optional(),
});

const forumTopicSchema = z.object({
  message_thread_id: z.number().int(),
  name: z.string(),
});

const botIdentitySchema = z.object({
  id: z.number().int(),
  is_bot: z.literal(true),
});

const operatorChatSchema = z.object({
  id: z.number().int(),
  is_forum: z.boolean().optional(),
  type: z.enum(['private', 'group', 'supergroup', 'channel']),
});

const botMembershipSchema = z.object({
  can_manage_topics: z.boolean().optional(),
  status: z.enum([
    'creator',
    'administrator',
    'member',
    'restricted',
    'left',
    'kicked',
  ]),
});

const webhookInfoSchema = z.object({
  url: z.string(),
});

const discoverableChatSchema = z.object({
  id: z.number().int(),
  is_forum: z.boolean().optional(),
  title: z.string().optional(),
  type: z.enum(['private', 'group', 'supergroup', 'channel']),
});

const discoveryUpdateSchema = z.object({
  message: z.object({ chat: discoverableChatSchema }).optional(),
  my_chat_member: z.object({ chat: discoverableChatSchema }).optional(),
});

export interface TelegramOperatorChat {
  id: number;
  isForum: boolean;
  title: string;
  type: 'group' | 'supergroup';
}

export type TelegramFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface GetUpdatesOptions {
  offset?: number;
  signal?: AbortSignal;
  timeoutSeconds: number;
}

export interface SendMessageOptions {
  chatId: number;
  messageThreadId?: number;
  replyMarkup?: TelegramReplyMarkup;
  signal?: AbortSignal;
  text: string;
}

export type TelegramReplyMarkup =
  TelegramRemoveKeyboard | TelegramReplyKeyboard | TelegramInlineKeyboard;

export interface TelegramInlineKeyboard {
  inline_keyboard: readonly (readonly {
    text: string;
    callback_data: string;
  }[])[];
}
export class TelegramKeyboardError extends Error {}
export class TelegramCallbackExpiredError extends Error {}

export interface TelegramRemoveKeyboard {
  remove_keyboard: true;
}

export interface TelegramReplyKeyboard {
  input_field_placeholder?: string;
  is_persistent?: true;
  keyboard: readonly (readonly { text: string }[])[];
  resize_keyboard: true;
}

export interface TelegramGateway {
  answerCallbackQuery?(id: string): Promise<void>;
  closeForumTopic(chatId: number, messageThreadId: number): Promise<void>;
  createForumTopic(chatId: number, name: string): Promise<{ topicId: number }>;
  getUpdates(options: GetUpdatesOptions): Promise<readonly TelegramUpdate[]>;
  reopenForumTopic(chatId: number, messageThreadId: number): Promise<void>;
  sendMessage(options: SendMessageOptions): Promise<{ messageId: number }>;
}

export class TelegramApiClient implements TelegramGateway {
  private readonly baseUrl: string;
  private readonly fetchImplementation: TelegramFetch;

  public constructor(
    token: string,
    fetchImplementation: TelegramFetch = fetch,
    private readonly onApiFailure: ApiFailureObserver = () => undefined,
  ) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.fetchImplementation = fetchImplementation;
  }

  public async answerCallbackQuery(id: string): Promise<void> {
    await this.call(
      'answerCallbackQuery',
      { callback_query_id: id },
      z.literal(true),
    );
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

  public async discoverOperatorChats(): Promise<
    readonly TelegramOperatorChat[]
  > {
    const updates = await this.call(
      'getUpdates',
      {
        allowed_updates: ['message', 'my_chat_member'],
        timeout: 0,
      },
      z.array(discoveryUpdateSchema),
    );
    const chats = new Map<number, TelegramOperatorChat>();

    for (const update of updates) {
      const chat = update.my_chat_member?.chat ?? update.message?.chat;
      if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) {
        continue;
      }
      chats.set(chat.id, {
        id: chat.id,
        isForum: chat.is_forum === true,
        title: chat.title ?? 'Telegram group ' + chat.id,
        type: chat.type,
      });
    }

    return [...chats.values()].sort((left, right) =>
      left.title.localeCompare(right.title),
    );
  }

  public async getUpdates(
    options: GetUpdatesOptions,
  ): Promise<readonly TelegramUpdate[]> {
    return this.call(
      'getUpdates',
      {
        allowed_updates: ['message', 'callback_query'],
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
        ...(options.replyMarkup === undefined
          ? {}
          : { reply_markup: options.replyMarkup }),
        text: options.text,
      },
      telegramMessageSchema,
      options.signal,
    );
    return { messageId: message.message_id };
  }

  public async verifySetup(operatorChatId: number): Promise<void> {
    const bot = await this.call('getMe', {}, botIdentitySchema);
    const chat = await this.call(
      'getChat',
      { chat_id: operatorChatId },
      operatorChatSchema,
    );
    if (chat.type !== 'supergroup') {
      throw new Error(
        'Telegram setup validation failed: operator chat must be a supergroup',
      );
    }
    if (chat.is_forum !== true) {
      throw new Error(
        'Telegram setup validation failed: Topics are not enabled in the operator group',
      );
    }

    const membership = await this.call(
      'getChatMember',
      { chat_id: operatorChatId, user_id: bot.id },
      botMembershipSchema,
    );
    if (
      membership.status !== 'creator' &&
      membership.status !== 'administrator'
    ) {
      throw new Error(
        'Telegram setup validation failed: the bot must be an operator group administrator',
      );
    }
    if (
      membership.status === 'administrator' &&
      membership.can_manage_topics !== true
    ) {
      throw new Error(
        'Telegram setup validation failed: the bot requires can_manage_topics',
      );
    }

    const webhook = await this.call('getWebhookInfo', {}, webhookInfoSchema);
    if (webhook.url.length > 0) {
      throw new Error(
        'Telegram setup validation failed: remove the configured webhook before using long polling',
      );
    }
  }

  private async call<Result>(
    method: string,
    payload: Readonly<Record<string, unknown>>,
    resultSchema: z.ZodType<Result>,
    signal?: AbortSignal,
  ): Promise<Result> {
    const failure = beginApiRequest('telegram', method, this.onApiFailure);
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
      if (hasUncertainSideEffect(method)) {
        throw failure(
          new DeliveryOutcomeUnknownError('telegram'),
          'transport',
          { cause: error },
        );
      }
      throw failure(
        new Error(`Telegram API request failed for ${method}`),
        'transport',
        { cause: error },
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw failure(
        responseValidationError(method, 'invalid JSON'),
        'invalid_response',
        { httpStatus: response.status },
      );
    }

    const envelope = apiEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
      throw failure(
        responseValidationError(method, 'an invalid response'),
        'invalid_response',
        { httpStatus: response.status },
      );
    }
    if (!response.ok || !envelope.data.ok) {
      const description = safeTelegramDescription(envelope.data.description);
      throw failure(
        envelope.data.error_code === 400 &&
          method === 'answerCallbackQuery' &&
          /query is too old|query id is invalid/i.test(
            envelope.data.description ?? '',
          )
          ? new TelegramCallbackExpiredError('Telegram callback expired')
          : envelope.data.error_code === 400 &&
              method === 'sendMessage' &&
              /keyboard|button|reply markup/i.test(
                envelope.data.description ?? '',
              )
            ? new TelegramKeyboardError('Telegram rejected the keyboard')
            : new Error(`Telegram API ${method} failed: ${description}`),
        'api',
        {
          httpStatus: response.status,
          ...(envelope.data.error_code === undefined
            ? {}
            : { apiCode: envelope.data.error_code }),
        },
      );
    }

    const result = resultSchema.safeParse(envelope.data.result);
    if (!result.success) {
      throw failure(
        responseValidationError(method, 'an invalid result'),
        'invalid_response',
        { httpStatus: response.status },
      );
    }
    return result.data;
  }
}

function safeTelegramDescription(description: string | undefined): string {
  const known = [
    'Unauthorized',
    'TOPIC_CLOSED',
    'TOPIC_NOT_MODIFIED',
    'TOPIC_DELETED',
    'message thread not found',
    'chat not found',
    'bot was blocked by the user',
    'bot was kicked',
    'not enough rights',
  ];
  return (
    known.find((value) =>
      description?.toLowerCase().includes(value.toLowerCase()),
    ) ?? 'request rejected'
  );
}

function responseValidationError(method: string, problem: string): Error {
  if (hasUncertainSideEffect(method)) {
    return new DeliveryOutcomeUnknownError('telegram');
  }
  return new Error(`Telegram API returned ${problem} for ${method}`);
}

function hasUncertainSideEffect(method: string): boolean {
  return (
    method === 'closeForumTopic' ||
    method === 'createForumTopic' ||
    method === 'reopenForumTopic' ||
    method === 'sendMessage'
  );
}

export function isAlreadyOpenForumTopicError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes('topic_not_modified')
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function isUnavailableForumTopicError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes('topic_closed') || isMissingForumTopicError(error);
}

export function isMissingForumTopicError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('topic_id_invalid') ||
    message.includes('message thread not found')
  );
}
