// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import RestoreAction from '@frontend/features/restore-content/ui/RestoreAction.vue';
import { response } from '@test/frontend/support/fake-response';

describe('revision review', () => {
  it('requires a loaded preview including hidden sections before publication', async () => {
    const pending = Promise.withResolvers<ReturnType<typeof response>>();
    const fetch = vi.fn().mockReturnValueOnce(pending.promise);
    vi.stubGlobal('fetch', fetch);
    const wrapper = mount(RestoreAction, {
      props: { revision: 1, pending: false, hasUnsavedChanges: true },
    });
    await wrapper.get('button').trigger('click');
    expect(
      wrapper
        .findAll('button')
        .find((b) => b.text() === 'Да, восстановить')!
        .attributes('disabled'),
    ).toBeDefined();
    expect(wrapper.emitted('restore')).toBeUndefined();
    pending.resolve(
      response({
        content: {
          schedule: '',
          scheduleItems: [],
          address: 'Hidden address',
          visibleSections: [],
        },
        version: 'a'.repeat(64),
      }),
    );
    await flushPromises();
    expect(wrapper.text()).toContain('Hidden address');
    expect(wrapper.text()).toContain('Скрыто в меню');
    expect(wrapper.text()).toContain('Несохранённые изменения будут потеряны');
    expect(fetch).toHaveBeenCalledWith(
      '/api/manage/content/history/1',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
    expect(wrapper.emitted('restore')).toBeUndefined();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Да, восстановить')!
      .trigger('click');
    expect(wrapper.emitted('restore')).toEqual([[1]]);
    wrapper.unmount();
  });
});
