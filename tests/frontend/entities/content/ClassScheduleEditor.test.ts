// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyContent,
  copyContentDraft,
} from '@frontend/entities/content/model/content-draft';
import { validateContentDraft } from '@frontend/entities/content/lib/content-validation';
import { populated } from './class-editor-test-helpers';
import ClassScheduleEditor from '@frontend/entities/content/ui/ClassScheduleEditor.vue';

async function click(wrapper: Pick<VueWrapper, 'findAll'>, label: string) {
  await wrapper
    .findAll('button')
    .find((item) => item.text() === label)!
    .trigger('click');
}
describe('teacher class workspace', () => {
  it('creates a group, keeps stable keyword targets and preserves edits while navigating', async () => {
    const draft = reactive(createEmptyContent());
    const wrapper = mount(ClassScheduleEditor, {
      props: { modelValue: draft },
    });
    await click(wrapper, 'Добавить направление');
    await wrapper.get('#new-direction-name').setValue('Тестовый танец');
    await wrapper.get('form').trigger('submit');
    const directionId = draft.directions[0]!.id;
    await click(wrapper, 'Добавить группу');
    const groupId = draft.groups[0]!.id;
    await wrapper.get('#group-name-' + groupId).setValue('Начинающие');
    await wrapper
      .get('#group-time-' + groupId + '-0')
      .setValue('Понедельник, 19:00\nЧетверг, 19:00');
    await wrapper.get('.class-check input').setValue(true);
    await click(wrapper, 'Добавить ключевое слово');
    await wrapper.get('#keyword-' + groupId + '-0').setValue('Тестовый танец');
    expect(draft.keywords).toEqual([
      { phrase: 'Тестовый танец', targetType: 'group', targetId: groupId },
    ]);
    expect(validateContentDraft(draft).valid).toBe(true);
    await click(wrapper, 'К направлению «Тестовый танец»');
    expect(wrapper.find('#group-name-' + groupId).exists()).toBe(false);
    await wrapper
      .get('#direction-' + directionId)
      .setValue('Новое направление');
    await wrapper.get('.class-list-item').trigger('click');
    expect(
      wrapper.get<HTMLTextAreaElement>('#group-time-' + groupId + '-0').element
        .value,
    ).toBe('Понедельник, 19:00\nЧетверг, 19:00');
    expect(draft.keywords[0]!.targetId).toBe(groupId);
    await click(wrapper, 'Посмотреть как клиент');
    expect(wrapper.emitted('preview')).toEqual([[`classes:group:${groupId}`]]);
    const copied = copyContentDraft(draft);
    copied.groups[0]!.meetings[0] = 'Другое время';
    expect(draft.groups[0]!.meetings[0]).toBe('Понедельник, 19:00');
  });
  it('prevents deleting a populated direction and removes only the selected group and its words', async () => {
    const draft = populated();
    draft.keywords.push({
      phrase: 'Тест',
      targetType: 'group',
      targetId: 'group',
    });
    const wrapper = mount(ClassScheduleEditor, {
      props: { modelValue: draft },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await wrapper.get('.class-list-item').trigger('click');
    await click(wrapper, 'Удалить направление');
    expect(draft.directions).toHaveLength(1);
    expect(wrapper.text()).toContain('Сначала перенесите группы');
    await wrapper.get('.class-list-item').trigger('click');
    await click(wrapper, 'Удалить группу');
    expect(draft.groups).toEqual([]);
    expect(draft.keywords).toEqual([]);
    expect(draft.directions).toHaveLength(1);
  });
  it('keeps unknown source visible until the teacher fills and opens enrollment in the same group', async () => {
    const draft = populated();
    draft.groups.push({
      id: 'review',
      directionId: '',
      name: '',
      meetings: [],
      description: '',
      enrollmentOpen: false,
      applicationQuestion: '',
      review: { source: 'Необычная запись\nСреда, 21:00\nС нуля' },
    });
    const wrapper = mount(ClassScheduleEditor, {
      props: { modelValue: draft },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await click(wrapper, 'Старые записи расписания: 1');
    await wrapper.get('.class-list-item').trigger('click');
    expect(wrapper.get('pre').text()).toBe(draft.groups[1]!.review!.source);
    expect(
      wrapper.get<HTMLInputElement>('.class-check input').element.disabled,
    ).toBe(false);
    await wrapper.get('.class-check input').setValue(true);
    expect(draft.groups[1]!.review).toBeDefined();
    await wrapper.get('#group-direction-review').setValue('dance');
    expect(wrapper.get('h2').text()).toContain('Тестовый танец');
    await wrapper.get('#group-name-review').setValue('Новая группа');
    await wrapper.get('#group-time-review-0').setValue('Среда, 21:00');
    await wrapper.get('#group-description-review').setValue('С нуля');
    await wrapper.get('.class-check input').setValue(true);
    expect(draft.groups[1]!.review).toBeUndefined();
    expect(draft.groups[1]!.enrollmentOpen).toBe(true);
    expect(validateContentDraft(draft).valid).toBe(true);
    await click(wrapper, 'К направлению «Тестовый танец»');
    expect(wrapper.get('h2').text()).toBe('Тестовый танец');
  });
  it('shows keyword conflicts with their destination and navigates there without discarding edits', async () => {
    const draft = populated();
    draft.keywords.push(
      { phrase: 'Тест', targetType: 'direction', targetId: 'dance' },
      { phrase: 'ТЕСТ', targetType: 'group', targetId: 'group' },
    );
    const wrapper = mount(ClassScheduleEditor, {
      props: { modelValue: draft },
    });
    await wrapper.get('.class-list-item').trigger('click');
    expect(wrapper.get('[role=alert]').text()).toContain(
      'Тестовый танец / Начинающие',
    );
    await click(wrapper, 'Перейти к настройке');
    expect(wrapper.find('#group-name-group').exists()).toBe(true);
    expect(validateContentDraft(draft).valid).toBe(false);
  });
});
