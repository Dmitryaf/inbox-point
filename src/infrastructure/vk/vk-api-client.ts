import { z } from 'zod';

import { vkLongPollEventSchema, type VkLongPollEvent } from './vk-types.js';

const apiVersion = '5.199';

const apiErrorSchema = z.object({
  error: z.object({
    error_code: z.number().int(),
    error_msg: z.string(),
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
  ): Promise<{ externalMessageId: string }>;
}

export class VkApiClient implements VkGateway {
  public constructor(
    private readonly accessToken: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  public async getLongPollServer(groupId: number): Promise<VkLongPollServer> {
    return this.call(
      'groups.getLongPollServer',
      { group_id: String(groupId) },
      longPollServerSchema,
    );
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
      throw new Error('VK Long Poll request failed');
    }
    if (!response.ok) {
      throw new Error(`VK Long Poll failed with HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    const parsed = longPollResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error('VK Long Poll returned an invalid response');
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
  ): Promise<{ externalMessageId: string }> {
    const result = await this.call(
      'messages.send',
      {
        message: text,
        peer_id: String(peerId),
        random_id: String(randomId),
      },
      sentMessageSchema,
    );
    const messageId = typeof result === 'number' ? result : result.message_id;
    return { externalMessageId: String(messageId) };
  }

  private async call<Result>(
    method: string,
    parameters: Readonly<Record<string, string>>,
    schema: z.ZodType<Result>,
  ): Promise<Result> {
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
    } catch {
      throw new Error(`VK API request failed for ${method}`);
    }
    if (!response.ok) {
      throw new Error(`VK API ${method} failed with HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    const apiError = apiErrorSchema.safeParse(payload);
    if (apiError.success) {
      throw new Error(
        `VK API ${method} failed with code ${apiError.data.error.error_code}`,
      );
    }
    const envelope = z.object({ response: schema }).safeParse(payload);
    if (!envelope.success) {
      throw new Error(`VK API ${method} returned an invalid response`);
    }
    return envelope.data.response;
  }
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
