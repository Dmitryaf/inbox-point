// @vitest-environment jsdom
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@frontend/entities/operations/api/operations-api';
import {
  incoming,
  openInbox,
  setupInbox,
  refreshInbox,
} from './operator-inbox-test-helpers';

vi.mock('@frontend/entities/operations/api/operations-api', () => ({
  readOperatorInboxRequests: vi.fn(),
  readOperatorInboxMessages: vi.fn(),
  sendOperatorInboxReply: vi.fn(),
  closeOperatorInboxRequest: vi.fn(),
}));
beforeEach(setupInbox);
describe('operator conversation selection', () => {
  it('keeps the current conversation DOM during automatic refresh', async () => {
    const wrapper = await openInbox();
    const list = wrapper.get('.operator-message-list').element;
    list.scrollTop = 120;
    const delayed = Promise.withResolvers<ReturnType<typeof incoming>>();
    vi.mocked(api.readOperatorInboxMessages).mockReturnValueOnce(
      delayed.promise,
    );
    const refreshing = refreshInbox(wrapper);
    await flushPromises();
    expect(wrapper.get('.operator-message-list').element).toBe(list);
    expect(list.scrollTop).toBe(120);
    delayed.resolve(incoming('A'));
    await refreshing;
    await flushPromises();
    expect(wrapper.get('.operator-message-list').element).toBe(list);
    wrapper.unmount();
  });
  it('clears old messages on failure, preserves per-request drafts and retries', async () => {
    const wrapper = await openInbox();
    await wrapper.get('#operator-reply').setValue('Draft A');
    vi.mocked(api.readOperatorInboxMessages).mockRejectedValueOnce(
      new Error('Load failed'),
    );
    await wrapper.findAll('.operator-request-button')[1]!.trigger('click');
    await flushPromises();
    expect(wrapper.find('.operator-message-list').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Message A');
    await wrapper.get('#operator-reply').setValue('Draft B');
    expect(
      wrapper.get('button[type="submit"]').attributes('disabled'),
    ).toBeDefined();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Повторить загрузку переписки')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Message B');
    await wrapper.findAll('.operator-request-button')[0]!.trigger('click');
    await flushPromises();
    expect(
      wrapper.get<HTMLTextAreaElement>('#operator-reply').element.value,
    ).toBe('Draft A');
    await wrapper.findAll('.operator-request-button')[1]!.trigger('click');
    await flushPromises();
    expect(
      wrapper.get<HTMLTextAreaElement>('#operator-reply').element.value,
    ).toBe('Draft B');
    wrapper.unmount();
  });

  it.each(['success', 'failure'])(
    'ignores a stale %s after a newer selection',
    async (outcome) => {
      const wrapper = await openInbox();
      const delayed = Promise.withResolvers<ReturnType<typeof incoming>>();
      vi.mocked(api.readOperatorInboxMessages).mockReturnValueOnce(
        delayed.promise,
      );
      await wrapper.findAll('.operator-request-button')[1]!.trigger('click');
      expect(wrapper.text()).not.toContain('Message A');
      await wrapper.findAll('.operator-request-button')[0]!.trigger('click');
      await flushPromises();
      if (outcome === 'success') {
        delayed.resolve(incoming('B'));
      } else {
        delayed.reject(new Error('Stale failure'));
      }
      await flushPromises();
      expect(wrapper.text()).toContain('Message A');
      expect(wrapper.text()).not.toContain('Message B');
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      wrapper.unmount();
    },
  );

  it('clears only the sent draft when switching during a reply', async () => {
    const wrapper = await openInbox();
    const sent = Promise.withResolvers<void>();
    vi.mocked(api.sendOperatorInboxReply).mockReturnValueOnce(sent.promise);
    await wrapper.get('#operator-reply').setValue('Reply A');
    await wrapper.get('form').trigger('submit');
    await wrapper.findAll('.operator-request-button')[1]!.trigger('click');
    await flushPromises();
    sent.resolve();
    await flushPromises();
    expect(api.sendOperatorInboxReply).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ text: 'Reply A' }),
    );
    await wrapper.get('#operator-reply').setValue('Draft B');
    await wrapper.findAll('.operator-request-button')[0]!.trigger('click');
    await flushPromises();
    expect(
      wrapper.get<HTMLTextAreaElement>('#operator-reply').element.value,
    ).toBe('');
    await wrapper.findAll('.operator-request-button')[1]!.trigger('click');
    await flushPromises();
    expect(
      wrapper.get<HTMLTextAreaElement>('#operator-reply').element.value,
    ).toBe('Draft B');
    wrapper.unmount();
  });
});
