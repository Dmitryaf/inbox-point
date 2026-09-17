// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import VkSetupCard from '@frontend/features/setup-vk/ui/VkSetupCard.vue';

describe('VkSetupCard', () => {
  it('keeps the outgoing-event requirement visible for an existing connection', async () => {
    const wrapper = mount(VkSetupCard, {
      props: {
        status: { connected: true, locked: true, source: 'local' },
        telegramConnected: true,
      },
    });

    await wrapper.get('.setup-toggle').trigger('click');

    expect(wrapper.text()).toContain(
      'должны быть включены «Входящие сообщения» и «Исходящие сообщения»',
    );
  });
});
