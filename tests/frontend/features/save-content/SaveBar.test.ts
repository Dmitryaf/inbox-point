// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import SaveBar from '@frontend/features/save-content/ui/SaveBar.vue';

describe('SaveBar', () => {
  it('explains invalid content and opens correction flow', async () => {
    const wrapper = mount(SaveBar, {
      props: {
        dirty: true,
        saving: false,
        validationMessage: 'Заполните название и текст раздела.',
        valid: false,
      },
    });

    expect(wrapper.text()).toContain('Заполните название и текст раздела.');
    expect(wrapper.get('button').text()).toBe('Исправить поля');
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('save')).toHaveLength(1);
  });
});
