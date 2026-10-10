// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyContent,
  copyContentDraft,
} from '@frontend/entities/content/model/content-draft';
import { validateContentDraft } from '@frontend/entities/content/lib/content-validation';
import ClassScheduleEditor from '@frontend/entities/content/ui/ClassScheduleEditor.vue';
import LegacyScheduleAssignment from '@frontend/entities/content/ui/LegacyScheduleAssignment.vue';
describe('teacher class editor', () => {
  it('creates a direction, a group with two meetings and a keyword targeting its stable ID', async () => {
    const draft = reactive(createEmptyContent());
    const wrapper = mount(ClassScheduleEditor, {
      props: { modelValue: draft },
    });
    await wrapper.get('#new-direction-name').setValue('Тестовый танец');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'Добавить направление')!
      .trigger('click');
    const directionId = draft.directions[0]!.id;
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'Добавить группу')!
      .trigger('click');
    const groupId = draft.groups[0]!.id;
    await wrapper.get(`#group-name-${groupId}`).setValue('Начинающие');
    await wrapper
      .get(`#group-time-${groupId}-0`)
      .setValue('Понедельник, 19:00');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'Добавить день и время')!
      .trigger('click');
    await wrapper.get(`#group-time-${groupId}-1`).setValue('Четверг, 19:00');
    await wrapper.get('.class-check input').setValue(true);
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'Добавить ключевое слово')!
      .trigger('click');
    await wrapper.get('#keyword-0').setValue('Тестовый танец');
    expect(draft.keywords).toEqual([
      { phrase: 'Тестовый танец', targetType: 'group', targetId: groupId },
    ]);
    expect(validateContentDraft(draft).valid).toBe(true);
    await wrapper
      .get(`#direction-${directionId}`)
      .setValue('Новое направление');
    await wrapper.get(`#group-name-${groupId}`).setValue('Новая группа');
    expect(draft.keywords[0]!.targetId).toBe(groupId);
    expect(wrapper.get('#keyword-target-0').text()).toContain(
      'Новое направление → Новая группа',
    );
    expect(wrapper.get('.class-preview').text()).toContain('Новая группа');
    const copied = copyContentDraft(draft);
    copied.groups[0]!.meetings[0] = 'Другое время';
    expect(draft.groups[0]!.meetings[0]).toBe('Понедельник, 19:00');
  });
  it('prevents deletion of a direction containing groups and removes keywords with explicit group deletion', async () => {
    const draft = reactive(createEmptyContent());
    draft.directions.push({ id: 'dance', name: 'Тестовый танец' });
    draft.groups.push({
      id: 'group',
      directionId: 'dance',
      name: 'Начинающие',
      meetings: ['Пн 19:00'],
      description: '',
      enrollmentOpen: false,
      applicationQuestion: '',
    });
    draft.keywords.push({
      phrase: 'Тест',
      targetType: 'group',
      targetId: 'group',
    });
    const wrapper = mount(ClassScheduleEditor, {
      props: { modelValue: draft },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'Удалить направление')!
      .trigger('click');
    expect(draft.directions).toHaveLength(1);
    expect(wrapper.text()).toContain('Сначала перенесите группы');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'Удалить группу')!
      .trigger('click');
    expect(draft.groups).toEqual([]);
    expect(draft.keywords).toEqual([]);
  });
  it('moves one legacy card explicitly with all fields and leaves other cards and raw text intact', async () => {
    const draft = reactive(createEmptyContent());
    draft.legacySchedule = 'Старый свободный текст';
    draft.directions.push({ id: 'dance', name: 'Тестовый танец' });
    draft.schedule.push(
      { title: 'Начинающие', dayTime: 'Пн / Чт 19:00', description: 'С нуля' },
      { title: 'Другая карточка', dayTime: 'Сб 12:00' },
    );
    const wrapper = mount(LegacyScheduleAssignment, {
      props: { modelValue: draft },
    });
    expect(draft.groups).toEqual([]);
    await wrapper.get('#legacy-class-direction').setValue('dance');
    await wrapper.get('button').trigger('click');
    expect(draft.groups[0]).toMatchObject({
      directionId: 'dance',
      name: 'Начинающие',
      meetings: ['Пн / Чт 19:00'],
      description: 'С нуля',
      enrollmentOpen: false,
    });
    expect(draft.schedule).toEqual([
      { title: 'Другая карточка', dayTime: 'Сб 12:00' },
    ]);
    expect(draft.legacySchedule).toBe('Старый свободный текст');
  });
});
