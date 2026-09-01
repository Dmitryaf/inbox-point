import { describe, expect, it, vi } from 'vitest';

import { VkApiClient } from './vk-api-client.js';

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
    if (!(body instanceof URLSearchParams))
      throw new Error('Expected form body');
    expect(body.toString()).toContain('v=5.199');
    expect(body.toString()).toContain('group_id=42');
    const pollUrl = fetchMock.mock.calls[3]?.[0];
    if (!(pollUrl instanceof URL)) throw new Error('Expected Long Poll URL');
    expect(pollUrl.toString()).toContain('act=a_check');
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
    if (!(body instanceof URLSearchParams))
      throw new Error('Expected form body');
    expect(body.toString()).toContain('screen_name=example_community');
    await expect(
      client.resolveCommunity('https://vk.com/club77'),
    ).resolves.toBe(77);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
