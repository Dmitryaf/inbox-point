// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import CustomSectionsEditor from '@frontend/entities/content/ui/CustomSectionsEditor.vue';
import type { CustomSection } from '@frontend/entities/content/model/types';

describe('CustomSectionsEditor', () => {
  it('explains both purposes and changes the question field without losing its text', async () => {
    const sections: CustomSection[] = [
      { label: 'Записаться', text: 'Когда хотите прийти?' },
    ];
    const wrapper = mount(CustomSectionsEditor, {
      props: { modelValue: sections },
    });
    expect(wrapper.get('input[value="information"]').element).toHaveProperty(
      'checked',
      true,
    );
    expect(wrapper.text()).toContain('Для чего нужна кнопка?');
    expect(wrapper.text()).toContain('передаст ответ администратору');
    await wrapper.get('input[value="application"]').setValue(true);
    expect(sections[0]?.mode).toBe('application');
    expect(wrapper.get('label[for="section-text-0"]').text()).toBe(
      'Что спросить у клиента?',
    );
    expect(wrapper.get('textarea').element).toHaveProperty(
      'value',
      'Когда хотите прийти?',
    );
    await wrapper.get('input[value="information"]').setValue(true);
    expect(wrapper.get('label[for="section-text-0"]').text()).toBe(
      'Текст ответа',
    );
  });
  it('moves custom sections without drag and drop', async () => {
    const sections = [
      { label: 'Подготовка', text: 'Возьмите сменную обувь.' },
      { label: 'Парковка', text: 'Въезд со двора.' },
    ];
    const wrapper = mount(CustomSectionsEditor, {
      props: { modelValue: sections },
    });

    expect(
      wrapper
        .get('[aria-label="Переместить раздел 1 выше"]')
        .attributes('disabled'),
    ).toBeDefined();
    await wrapper
      .get('[aria-label="Переместить раздел 2 выше"]')
      .trigger('click');

    expect(sections.map((section) => section.label)).toEqual([
      'Парковка',
      'Подготовка',
    ]);
  });
});
