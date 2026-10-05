// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import TelegramSetupCard from '@frontend/features/setup-telegram/ui/TelegramSetupCard.vue';

describe('TelegramSetupCard', () => {
  it('exposes disclosure state and discards the token when the form is closed', async () => {
    const wrapper = mount(TelegramSetupCard, {
      attachTo: document.body,
      props: {
        status: { connected: false, locked: false, source: 'none' },
        vkConfigured: false,
      },
    });
    const toggle = wrapper.get('[aria-controls="telegram-setup-details"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('#telegram-setup-details').isVisible()).toBe(false);
    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('#telegram-setup-details').isVisible()).toBe(true);
    await wrapper.get('#telegram-token').setValue('synthetic-hidden-token');
    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('#telegram-token').exists()).toBe(false);
    await toggle.trigger('click');
    expect(wrapper.get<HTMLInputElement>('#telegram-token').element.value).toBe(
      '',
    );
    wrapper.unmount();
  });
});
