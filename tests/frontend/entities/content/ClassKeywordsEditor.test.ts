// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ClassKeywordsEditor from '@frontend/entities/content/ui/ClassKeywordsEditor.vue';
import { populated } from './class-editor-test-helpers';

describe('group announcement keywords', () => {
  it('preserves an existing direction word until it is explicitly assigned to this group', async () => {
    const draft = populated();
    draft.keywords.push({
      phrase: 'Бачата',
      targetType: 'direction',
      targetId: 'dance',
    });
    const wrapper = mount(ClassKeywordsEditor, {
      props: { modelValue: draft, targetType: 'group', targetId: 'group' },
    });
    expect(wrapper.get('input').element).toHaveProperty('value', 'Бачата');
    expect(wrapper.text()).not.toContain('пока открывает всё направление');
    expect(draft.keywords[0]!.targetType).toBe('direction');
    await wrapper
      .findAll('button')
      .find(
        (button) => button.text() === 'Использовать «Бачата» для этой группы',
      )!
      .trigger('click');
    expect(draft.keywords).toEqual([
      { phrase: 'Бачата', targetType: 'group', targetId: 'group' },
    ]);
    expect(wrapper.get('input').element).toHaveProperty('value', 'Бачата');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Добавить ключевое слово')!
      .trigger('click');
    expect(draft.keywords[1]).toEqual({
      phrase: '',
      targetType: 'group',
      targetId: 'group',
    });
  });
});
