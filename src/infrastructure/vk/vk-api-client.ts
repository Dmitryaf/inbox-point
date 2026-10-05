import { z } from 'zod';
import {
  beginApiRequest,
  type ApiFailureObserver,
} from '@/infrastructure/diagnostics/api-request-diagnostic.js';

import { vkLongPollEventSchema, type VkLongPollEvent } from './vk-types.js';

const apiVersion = '5.199';

const apiErrorSchema = z.object({
  error: z.object({
    error_code: z.number().int(),
    error_msg: z.string(),
  }),
});

const vkBooleanSchema = z
  .union([z.boolean(), z.literal(0), z.literal(1)])
  .transform(Boolean);

const tokenPermissionsSchema = z.object({
  mask: z.number().int().nonnegative(),
  permissions: z.array(
    z.object({
      name: z.string(),
      setting: z.number().int().nonnegative(),
    }),
  ),
});

const longPollSettingsSchema = z.object({
  is_enabled: vkBooleanSchema,
  events: z.object({
    message_new: vkBooleanSchema,
    message_reply: vkBooleanSchema,
  }),
});

const longPollServerSchema = z.object({
  key: z.string().min(1),
  server: z.string().url(),
  ts: z.union([z.string(), z.number()]).transform(String),
});

const longPollResponseSchema = z.union([
  z.object({
    ts: z.union([z.string(), z.number()]).transform(String),
    updates: z.array(vkLongPollEventSchema),
  }),
  z.object({
    failed: z.number().int(),
    ts: z.union([z.string(), z.number()]).transform(String).optional(),
  }),
]);

const usersSchema = z.array(
  z.object({
    first_name: z.string(),
    id: z.number().int(),
    last_name: z.string(),
  }),
);

const sentMessageSchema = z.union([
  z.number().int(),
  z.object({ message_id: z.number().int() }),
]);

const resolvedNameSchema = z.object({
  object_id: z.number().int().positive(),
  type: z.string(),
});

export interface VkLongPollServer {
  key: string;
  server: string;
  ts: string;
}

export interface VkLongPollSettings {
  enabled: boolean;
  messageNew: boolean;
  messageReply: boolean;
}

export interface VkTokenPermissions {
  names: readonly string[];
}

export type VkLongPollResponse =
  | { ts: string; updates: readonly VkLongPollEvent[] }
  | { failed: number; ts?: string };

export interface VkGateway {
  getLongPollServer(groupId: number): Promise<VkLongPollServer>;
  getUserDisplayName(userId: number): Promise<string>;
  poll(
    server: VkLongPollServer,
    waitSeconds: number,
    signal: AbortSignal,
  ): Promise<VkLongPollResponse>;
  sendMessage(
    peerId: number,
    text: string,
    randomId: number,
    keyboard?: VkKeyboard,
  ): Promise<{ externalMessageId: string }>;
}

export class VkApiError extends Error {
  public constructor(
    public readonly code: number,
    method: string,
  ) {
    super(`VK API ${method} failed with code ${code}`);
    this.name = 'VkApiError';
  }
}

export interface VkKeyboard {
  buttons: readonly (readonly VkKeyboardButton[])[];
  inline: false;
  one_time: false;
}

export interface VkKeyboardButton {
  action: {
    label: string;
    payload: string;
    type: 'text';
  };
  color: 'primary' | 'secondary';
}

export class VkApiClient implements VkGateway {
  public constructor(
    private readonly accessToken: string,
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly onApiFailure: ApiFailureObserver = () => undefined,
  ) {}

  public async getLongPollServer(groupId: number): Promise<VkLongPollServer> {
    return this.call(
      'groups.getLongPollServer',
      { group_id: String(groupId) },
      longPollServerSchema,
    );
  }

  public async getLongPollSettings(
    groupId: number,
  ): Promise<VkLongPollSettings> {
    const settings = await this.call(
      'groups.getLongPollSettings',
      { group_id: String(groupId) },
      longPollSettingsSchema,
    );
    return {
      enabled: settings.is_enabled,
      messageNew: settings.events.message_new,
      messageReply: settings.events.message_reply,
    };
  }

  public async getTokenPermissions(): Promise<VkTokenPermissions> {
    const permissions = await this.call(
      'groups.getTokenPermissions',
      {},
      tokenPermissionsSchema,
    );
    return { names: permissions.permissions.map(({ name }) => name) };
  }

  public async resolveCommunity(reference: string): Promise<number> {
    const screenName = normalizeCommunityReference(reference);
    const numericId = /^(?:club|public)?(\d+)$/i.exec(screenName)?.[1];
    if (numericId) {
      return Number(numericId);
    }
    const resolved = await this.call(
      'utils.resolveScreenName',
      { screen_name: screenName },
      resolvedNameSchema,
    );
    if (resolved.type !== 'group') {
      throw new Error('VK reference does not point to a community');
    }
    return resolved.object_id;
  }

  public async getUserDisplayName(userId: number): Promise<string> {
    const users = await this.call(
      'users.get',
      { user_ids: String(userId) },
      usersSchema,
    );
    const user = users[0];
    return user
      ? `${user.first_name} ${user.last_name}`.trim()
      : `VK ${userId}`;
  }

  public async poll(
    server: VkLongPollServer,
    waitSeconds: number,
    signal: AbortSignal,
  ): Promise<VkLongPollResponse> {
    const failure = beginApiRequest('vk', 'longPoll', this.onApiFailure);
    const url = new URL(server.server);
    url.searchParams.set('act', 'a_check');
    url.searchParams.set('key', server.key);
    url.searchParams.set('ts', server.ts);
    url.searchParams.set('wait', String(waitSeconds));

    let response: Response;
    try {
      response = await this.fetchImplementation(url, { signal });
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw error;
      }
      throw failure(new Error('VK Long Poll request failed'), 'transport', {
        cause: error,
      });
    }
    if (!response.ok) {
      throw failure(
        new Error(`VK Long Poll failed with HTTP ${response.status}`),
        'http',
        { httpStatus: response.status },
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw failure(
        new Error('VK Long Poll returned invalid JSON'),
        'invalid_response',
        { httpStatus: response.status },
      );
    }
    const parsed = longPollResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw failure(
        new Error('VK Long Poll returned an invalid response'),
        'invalid_response',
        { httpStatus: response.status },
      );
    }
    if ('failed' in parsed.data) {
      return {
        failed: parsed.data.failed,
        ...(parsed.data.ts ? { ts: parsed.data.ts } : {}),
      };
    }
    return parsed.data;
  }

  public async sendMessage(
    peerId: number,
    text: string,
    randomId: number,
    keyboard?: VkKeyboard,
  ): Promise<{ externalMessageId: string }> {
    let result: z.infer<typeof sentMessageSchema>;
    try {
      result = await this.call(
        'messages.send',
        {
          message: text,
          peer_id: String(peerId),
          random_id: String(randomId),
          ...(keyboard ? { keyboard: JSON.stringify(keyboard) } : {}),
        },
        sentMessageSchema,
      );
    } catch (error: unknown) {
      if (!keyboard || !isKeyboardUnavailableError(error)) {
        throw error;
      }
      result = await this.call(
        'messages.send',
        {
          message: text,
          peer_id: String(peerId),
          random_id: String(randomId),
        },
        sentMessageSchema,
      );
    }
    const messageId = typeof result === 'number' ? result : result.message_id;
    return { externalMessageId: String(messageId) };
  }

  private async call<Result>(
    method: string,
    parameters: Readonly<Record<string, string>>,
    schema: z.ZodType<Result>,
  ): Promise<Result> {
    const failure = beginApiRequest('vk', method, this.onApiFailure);
    const body = new URLSearchParams({
      ...parameters,
      access_token: this.accessToken,
      v: apiVersion,
    });
    let response: Response;
    try {
      response = await this.fetchImplementation(
        `https://api.vk.com/method/${method}`,
        {
          body,
          method: 'POST',
        },
      );
    } catch (error: unknown) {
      throw failure(
        new Error(`VK API request failed for ${method}`),
        'transport',
        { cause: error },
      );
    }
    if (!response.ok) {
      throw failure(
        new Error(`VK API ${method} failed with HTTP ${response.status}`),
        'http',
        { httpStatus: response.status },
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw failure(
        new Error(`VK API ${method} returned invalid JSON`),
        'invalid_response',
        { httpStatus: response.status },
      );
    }
    const apiError = apiErrorSchema.safeParse(payload);
    if (apiError.success) {
      throw failure(
        new VkApiError(apiError.data.error.error_code, method),
        'api',
        {
          httpStatus: response.status,
          apiCode: apiError.data.error.error_code,
        },
      );
    }
    const envelope = z.object({ response: schema }).safeParse(payload);
    if (!envelope.success) {
      throw failure(
        new Error(`VK API ${method} returned an invalid response`),
        'invalid_response',
        { httpStatus: response.status },
      );
    }
    return envelope.data.response;
  }
}

function isKeyboardUnavailableError(error: unknown): boolean {
  return (
    error instanceof VkApiError && (error.code === 911 || error.code === 912)
  );
}

function normalizeCommunityReference(reference: string): string {
  const normalized = reference.trim().replace(/\/+$/, '');
  const lastSegment = normalized.split('/').at(-1)?.split('?')[0]?.trim();
  if (!lastSegment) {
    throw new Error('VK community reference is invalid');
  }
  return lastSegment;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
