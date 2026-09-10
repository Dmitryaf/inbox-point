// @vitest-environment jsdom

import { mount } from '@test/frontend/support/react-test-utils';
import { describe, expect, it } from 'vitest';

import CustomSectionsEditor from '@frontend/entities/content/ui/CustomSectionsEditor';

describe('CustomSectionsEditor', () => {
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
