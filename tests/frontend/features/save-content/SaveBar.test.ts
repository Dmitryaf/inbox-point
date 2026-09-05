// @vitest-environment jsdom

import { mount } from '@test/frontend/support/react-test-utils';
import { describe, expect, it } from 'vitest';

import SaveBar from '@frontend/features/save-content/ui/SaveBar';

describe('SaveBar', () => {
  it('explains invalid content and prevents publishing it', () => {
    const wrapper = mount(SaveBar, {
      props: {
        dirty: true,
        saving: false,
        validationMessage: 'Заполните название и текст раздела.',
        valid: false,
      },
    });

    expect(wrapper.text()).toContain('Заполните название и текст раздела.');
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  });
});
