// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import VkSetupCard from '@frontend/features/setup-vk/ui/VkSetupCard.vue';

describe('VkSetupCard', () => {
  it('does not repeat setup instructions for an existing connection', async () => {
    const wrapper = mount(VkSetupCard, {
      props: {
        status: { connected: true, locked: true, source: 'local' },
        telegramConnected: true,
      },
    });

    await wrapper.get('.setup-toggle').trigger('click');

    expect(wrapper.text()).toContain('Подключение активно.');
    expect(wrapper.text()).not.toContain('Для переноса ручных ответов');
  });
});
