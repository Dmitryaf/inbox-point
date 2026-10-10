// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ClassGroupEditor from '@frontend/entities/content/ui/ClassGroupEditor.vue';
import { classEnrollmentIssue } from '@frontend/entities/content/model/class-enrollment';
import { populated } from './class-editor-test-helpers';

function reviewed() {
  const draft = reactive(populated());
  draft.groups.push({
    ...draft.groups[0]!,
    id: 'old',
    enrollmentOpen: false,
    meetings: ['Пн/Ср 20:00'],
    review: { source: 'Группа для новичков\nПн/Ср 20:00\nМожно с нуля' },
  });
  return draft;
}
afterEach(() => vi.restoreAllMocks());
describe('old schedule groups', () => {
  it('explains duplicate names and keeps the source and closed enrollment after rejection', async () => {
    const draft = reviewed();
    const source = draft.groups[1]!.review!.source;
    const wrapper = mount(ClassGroupEditor, {
      props: { modelValue: draft, groupId: 'old' },
    });
    expect(wrapper.get('[role=alert]').text()).toContain('уже есть');
    const open = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Открыть существующую группу')!;
    await open.trigger('click');
    expect(wrapper.emitted('openTarget')).toEqual([['group', 'group']]);
    await wrapper.get('.class-check input').setValue(true);
    expect(draft.groups[1]!.enrollmentOpen).toBe(false);
    expect(
      wrapper.get<HTMLInputElement>('.class-check input').element.checked,
    ).toBe(false);
    expect(draft.groups[1]!.review!.source).toBe(source);
    await wrapper.get('#group-name-old').setValue('Другая группа');
    await wrapper.get('.class-check input').setValue(true);
    expect(draft.groups[1]!.review).toBeUndefined();
    expect(draft.groups[1]!.enrollmentOpen).toBe(true);
    expect(draft.groups[0]!.name).toBe('Начинающие');
  });
  it('offers visible deletion, respects cancellation and removes only its own keywords', async () => {
    const draft = reviewed();
    draft.keywords = [
      { phrase: 'Первая', targetType: 'group', targetId: 'group' },
      { phrase: 'Старая', targetType: 'group', targetId: 'old' },
    ];
    const wrapper = mount(ClassGroupEditor, {
      props: { modelValue: draft, groupId: 'old' },
    });
    const remove = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Удалить группу')!;
    expect(remove.element.closest('details')).toBeNull();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await remove.trigger('click');
    expect(draft.groups).toHaveLength(2);
    expect(draft.groups[1]!.review).toBeDefined();
    confirm.mockReturnValue(true);
    await remove.trigger('click');
    expect(draft.groups.map((group) => group.id)).toEqual(['group']);
    expect(draft.keywords.map((word) => word.phrase)).toEqual(['Первая']);
    expect(wrapper.emitted('removed')).toEqual([[]]);
  });
  it('identifies missing fields before opening enrollment and leaves the source untouched', () => {
    const draft = reviewed();
    const group = draft.groups[1]!;
    group.directionId = '';
    expect(classEnrollmentIssue(draft, group)).toContain(
      'Выберите направление',
    );
    group.directionId = 'dance';
    group.name = '';
    expect(classEnrollmentIssue(draft, group)).toContain('название');
    group.name = 'Другая';
    group.meetings = [];
    expect(classEnrollmentIssue(draft, group)).toContain('дни и время');
    expect(group.review).toBeDefined();
    group.meetings = ['Пн 20:00, Ср 19:00'];
    expect(classEnrollmentIssue(draft, group)).toBeUndefined();
  });
});
