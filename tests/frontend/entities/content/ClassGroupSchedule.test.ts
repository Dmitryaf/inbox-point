// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ClassGroupEditor from '@frontend/entities/content/ui/ClassGroupEditor.vue';
import { populated } from './class-editor-test-helpers';

describe('one schedule field', () => {
  it('preserves every existing meeting and saves combined days without rewriting them', async () => {
    const draft = populated();
    const meetings = ['Пн/Ср — 20:00', 'Пятница, 19:00'];
    draft.groups[0]!.meetings = [...meetings];
    const wrapper = mount(ClassGroupEditor, {
      props: { modelValue: draft, groupId: 'group' },
    });
    const field = wrapper.get<HTMLTextAreaElement>('#group-time-group-0');
    expect(field.element.value).toBe(meetings.join('\n'));
    expect(draft.groups[0]!.meetings).toEqual(meetings);
    await field.setValue('Пн 20:00, Ср 19:00\nПятница, 19:00');
    expect(draft.groups[0]!.meetings).toEqual([
      'Пн 20:00, Ср 19:00',
      'Пятница, 19:00',
    ]);
    await wrapper.get('.class-check input').setValue(true);
    await wrapper.get('#group-question-group').setValue('Когда хотите прийти?');
    await wrapper.get('.class-check input').setValue(false);
    expect(wrapper.get('#group-question-group').isVisible()).toBe(false);
    expect(draft.groups[0]!.applicationQuestion).toBe('Когда хотите прийти?');
  });
});
