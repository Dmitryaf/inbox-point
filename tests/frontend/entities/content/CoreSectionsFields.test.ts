// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { createEmptyContent } from '@frontend/entities/content/model/content-draft';
import CoreSectionsFields from '@frontend/entities/content/ui/CoreSectionsFields.vue';

describe('CoreSectionsFields', () => {
  it('makes collapsed sections visibly discoverable and expandable', async () => {
    const wrapper = mount(CoreSectionsFields, {
      props: { modelValue: createEmptyContent() },
    });
    const prices = wrapper.findAll('details')[1];
    if (!prices) {
      throw new Error('Expected the prices section');
    }

    expect(prices.element.open).toBe(false);
    expect(prices.get('summary').text()).toContain('Не заполнено');
    expect(prices.get('summary').text()).not.toContain('настройки раздела');
    expect(prices.find('.disclosure-chevron').exists()).toBe(true);

    await prices.get('summary').trigger('click');

    expect(prices.element.open).toBe(true);
    expect(prices.get('summary').text()).toContain('Не заполнено');
  });
});
