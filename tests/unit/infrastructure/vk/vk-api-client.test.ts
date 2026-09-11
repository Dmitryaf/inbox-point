import { describe, expect, it, vi } from 'vitest';

import { VkApiClient } from '@/infrastructure/vk/vk-api-client.js';

describe('VkApiClient', () => {
  it('uses VK API 5.199 and parses Long Poll and send responses', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          response: {
            key: 'long-poll-key',
            server: 'https://lp.vk.test/poll',
            ts: '10',
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          response: [{ first_name: 'Test', id: 101, last_name: 'Customer' }],
        }),
      )
      .mockResolvedValueOnce(Response.json({ response: 701 }))
      .mockResolvedValueOnce(Response.json({ ts: '11', updates: [] }));
    const client = new VkApiClient('synthetic-vk-token', fetchMock);

    const server = await client.getLongPollServer(42);
    await expect(client.getUserDisplayName(101)).resolves.toBe('Test Customer');
    await expect(client.sendMessage(101, 'Answer', 123)).resolves.toEqual({
      externalMessageId: '701',
    });
    await expect(
      client.poll(server, 25, new AbortController().signal),
    ).resolves.toEqual({ ts: '11', updates: [] });

    const methodRequest = fetchMock.mock.calls[0];
    expect(methodRequest?.[0]).toBe(
      'https://api.vk.com/method/groups.getLongPollServer',
    );
    const body = methodRequest?.[1]?.body;
    if (!(body instanceof URLSearchParams)) {
      throw new Error('Expected form body');
    }
    expect(body.toString()).toContain('v=5.199');
    expect(body.toString()).toContain('group_id=42');
    const pollUrl = fetchMock.mock.calls[3]?.[0];
    if (!(pollUrl instanceof URL)) {
      throw new Error('Expected Long Poll URL');
    }
    expect(pollUrl.toString()).toContain('act=a_check');
  });

  it('accepts supported and unsupported events in one Long Poll batch', async () => {
    const updates = [
      {
        event_id: 'message-1',
        group_id: 42,
        object: {
          message: {
            date: 1_788_177_600,
            from_id: 101,
            id: 501,
            peer_id: 101,
            text: 'First question',
          },
        },
        type: 'message_new',
      },
      {
        event_id: 'group-join-1',
        group_id: 42,
        object: {
          join_type: 'join',
          user_id: 101,
        },
        type: 'group_join',
      },
      {
        event_id: 'message-2',
        group_id: 42,
        object: {
          message: {
            date: 1_788_177_601,
            from_id: 102,
            id: 502,
            peer_id: 102,
            text: 'Second question',
          },
        },
        type: 'message_new',
      },
    ];
    const client = new VkApiClient(
      'synthetic-vk-token-for-mixed-batch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ ts: '12', updates })),
    );

    await expect(
      client.poll(
        { key: 'key', server: 'https://lp.vk.test/poll', ts: '11' },
        25,
        new AbortController().signal,
      ),
    ).resolves.toEqual({ ts: '12', updates });
  });

  it('does not expose the token or VK error text', async () => {
    const token = 'private-vk-token';
    const client = new VkApiClient(
      token,
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          error: {
            error_code: 5,
            error_msg: `Authorization failed for ${token}`,
          },
        }),
      ),
    );

    const request = client.getLongPollServer(42);

    await expect(request).rejects.toThrowError(
      'VK API groups.getLongPollServer failed with code 5',
    );
    await expect(request).rejects.not.toThrowError(new RegExp(token));
  });

  it('reads key permissions and Long Poll settings separately', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          response: {
            mask: 266_240,
            permissions: [
              { name: 'manage', setting: 262_144 },
              { name: 'messages', setting: 4_096 },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          response: {
            events: { message_new: 1 },
            is_enabled: 1,
          },
        }),
      );
    const client = new VkApiClient('synthetic-vk-token', fetchMock);

    await expect(client.getTokenPermissions()).resolves.toEqual({
      names: ['manage', 'messages'],
    });
    await expect(client.getLongPollSettings(42)).resolves.toEqual({
      enabled: true,
      messageNew: true,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.vk.com/method/groups.getTokenPermissions',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://api.vk.com/method/groups.getLongPollSettings',
    );
  });

  it('resolves a community link without requiring a numeric group id', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ response: { object_id: 42, type: 'group' } }),
      );
    const client = new VkApiClient(
      'synthetic-vk-token-for-community',
      fetchMock,
    );

    await expect(
      client.resolveCommunity('https://vk.com/example_community/'),
    ).resolves.toBe(42);
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    if (!(body instanceof URLSearchParams)) {
      throw new Error('Expected form body');
    }
    expect(body.toString()).toContain('screen_name=example_community');
    await expect(
      client.resolveCommunity('https://vk.com/club77'),
    ).resolves.toBe(77);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('serializes a persistent keyboard for client messages', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ response: 701 }));
    const client = new VkApiClient(
      'synthetic-vk-token-for-keyboard',
      fetchMock,
    );

    await client.sendMessage(101, 'Choose', 123, {
      buttons: [
        [
          {
            action: {
              label: 'Расписание',
              payload: '{\action\:\schedule\}',
              type: 'text',
            },
            color: 'secondary',
          },
        ],
      ],
      inline: false,
      one_time: false,
    });

    const body = fetchMock.mock.calls[0]?.[1]?.body;
    if (!(body instanceof URLSearchParams)) {
      throw new Error('Expected form body');
    }
    const keyboard = body.get('keyboard');
    expect(keyboard).not.toBeNull();
    expect(JSON.parse(keyboard ?? '')).toMatchObject({
      buttons: [[{ action: { label: 'Расписание' } }]],
      inline: false,
      one_time: false,
    });
  });

  it('delivers the message without a keyboard when bot features are disabled', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          error: {
            error_code: 912,
            error_msg: 'Bot features are disabled',
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ response: 702 }));
    const client = new VkApiClient(
      'synthetic-vk-token-for-fallback',
      fetchMock,
    );

    await expect(
      client.sendMessage(101, 'Important operator answer', 124, {
        buttons: [],
        inline: false,
        one_time: false,
      }),
    ).resolves.toEqual({ externalMessageId: '702' });

    const firstBody = fetchMock.mock.calls[0]?.[1]?.body;
    const secondBody = fetchMock.mock.calls[1]?.[1]?.body;
    if (
      !(firstBody instanceof URLSearchParams) ||
      !(secondBody instanceof URLSearchParams)
    ) {
      throw new Error('Expected form bodies');
    }
    expect(firstBody.has('keyboard')).toBe(true);
    expect(secondBody.has('keyboard')).toBe(false);
    expect(secondBody.get('message')).toBe('Important operator answer');
    expect(secondBody.get('random_id')).toBe('124');
  });

  it('does not hide non-keyboard delivery errors', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        error: {
          error_code: 901,
          error_msg: 'Customer cannot receive messages',
        },
      }),
    );
    const client = new VkApiClient('synthetic-vk-token-for-error', fetchMock);

    await expect(
      client.sendMessage(101, 'Answer', 125, {
        buttons: [],
        inline: false,
        one_time: false,
      }),
    ).rejects.toThrow('VK API messages.send failed with code 901');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
