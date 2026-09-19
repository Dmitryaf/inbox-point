// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { validateContentDraft } from '@frontend/entities/content/lib/content-validation';
import { createEmptyContent } from '@frontend/entities/content/model/content-draft';
import ScheduleEditor from '@frontend/entities/content/ui/ScheduleEditor.vue';

describe('ScheduleEditor', () => {
  it('adds, reorders, and removes schedule items', async () => {
    const content = createEmptyContent();
    const wrapper = mount(ScheduleEditor, {
      props: { modelValue: content },
    });

    await wrapper.get('button:not([class])').trigger('click');
    await wrapper.get('#schedule-title-0').setValue('Начинающие');
    await wrapper.get('#schedule-day-time-0').setValue('Вт / Чт, 19:00');
    await wrapper.get('#schedule-description-0').setValue('С нуля.');
    await wrapper.get('button:not([class])').trigger('click');
    await wrapper.get('#schedule-title-1').setValue('Продолжающие');
    await wrapper.get('#schedule-day-time-1').setValue('Пн / Ср, 20:00');

    await wrapper
      .get('[aria-label="Переместить направление 2 выше"]')
      .trigger('click');
    expect(content.schedule.map((item) => item.title)).toEqual([
      'Продолжающие',
      'Начинающие',
    ]);

    await wrapper.findAll('button.danger')[0]!.trigger('click');
    expect(content.schedule).toEqual([
      {
        dayTime: 'Вт / Чт, 19:00',
        description: 'С нуля.',
        title: 'Начинающие',
      },
    ]);
  });

  it('binds required-field errors and allows an omitted description', () => {
    const content = createEmptyContent();
    content.schedule.push({ dayTime: '', title: 'Бачата' });
    const validation = validateContentDraft(content);
    const wrapper = mount(ScheduleEditor, {
      props: {
        errors: Object.fromEntries(
          validation.issues.map((issue) => [issue.fieldId, issue.message]),
        ),
        modelValue: content,
      },
    });

    expect(validation.valid).toBe(false);
    expect(wrapper.get('#schedule-day-time-0').attributes('aria-invalid')).toBe(
      'true',
    );
    expect(wrapper.get('#schedule-title-0').attributes('placeholder')).toBe(
      'Бачата — начинающие',
    );
    expect(wrapper.get('#schedule-day-time-0').attributes('placeholder')).toBe(
      'Вт / Чт, 19:00',
    );
    expect(
      wrapper.get('#schedule-description-0').attributes('placeholder'),
    ).toBe('Подходит тем, кто начинает с нуля.');

    content.schedule[0]!.dayTime = 'Вт / Чт, 19:00';
    expect(validateContentDraft(content).valid).toBe(true);
  });

  it('keeps legacy text visible while a manual structured replacement is drafted', async () => {
    const content = createEmptyContent();
    content.legacySchedule = 'Свободный старый текст';
    const wrapper = mount(ScheduleEditor, {
      props: { modelValue: content },
    });

    expect(wrapper.get('#legacy-schedule').text()).toContain(
      'Свободный старый текст',
    );
    expect(wrapper.get('.visibility-control input').element).toHaveProperty(
      'checked',
      true,
    );

    await wrapper.get('button:not([class])').trigger('click');
    expect(content.legacySchedule).toBe('Свободный старый текст');
    expect(content.schedule).toEqual([{ dayTime: '', title: '' }]);
  });
});
