// @vitest-environment jsdom
import { mount } from '@test/frontend/support/react-test-utils';
import { describe, expect, it } from 'vitest';
import ClassKeywordsEditor from '@frontend/entities/content/ui/ClassKeywordsEditor';
import { normalizeContentDraft } from '@frontend/entities/content/model/content-draft';
import { populated } from './class-editor-test-helpers';

describe('group announcement keywords', () => {
  it('ignores legacy direction words and creates and removes only group keywords', async () => {
    const draft = populated();
    draft.keywords.push({
      phrase: 'Бачата',
      targetType: 'direction',
      targetId: 'dance',
    });
    const content = normalizeContentDraft(draft);
    const wrapper = mount(ClassKeywordsEditor, {
      props: { modelValue: content, targetType: 'group', targetId: 'group' },
    });
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.text()).not.toContain(
      'Сохранённое слово для всего направления',
    );
    expect(wrapper.text()).not.toContain('Использовать «');
    expect(draft.keywords[0]!.targetType).toBe('direction');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Добавить ключевое слово')!
      .trigger('click');
    await wrapper.get('input').setValue('Бачата');
    expect(content.keywords).toEqual([
      { phrase: 'Бачата', targetType: 'group', targetId: 'group' },
    ]);
    expect(wrapper.get('input').element).toHaveProperty('value', 'Бачата');
    await wrapper.get('button.danger').trigger('click');
    expect(content.keywords).toEqual([]);
  });
});
