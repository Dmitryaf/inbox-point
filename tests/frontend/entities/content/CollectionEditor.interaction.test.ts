// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyContent } from '@frontend/entities/content/model/content-draft';
import {
  getCoreResponseLengths,
  findOversizedContentResponse,
} from '@frontend/entities/content/lib/content-response-limit';
import FaqEditor from '@frontend/entities/content/ui/FaqEditor.vue';
import CustomSectionsEditor from '@frontend/entities/content/ui/CustomSectionsEditor.vue';

describe('collection editing continuity', () => {
  it.each(['faq', 'custom'] as const)(
    'keeps focus and protects deletion in %s',
    async (kind) => {
      const draft = reactive(createEmptyContent());
      draft.schedule = ['A', 'B', 'C'].map((title) => ({
        title,
        dayTime: 'Monday',
      }));
      draft.faq = ['A', 'B', 'C'].map((question) => ({
        question,
        answer: 'Answer',
      }));
      draft.customSections = ['A', 'B', 'C'].map((label) => ({
        label,
        text: 'Text',
      }));
      const wrapper =
        kind === 'faq'
          ? mount(FaqEditor, {
              attachTo: document.body,
              props: { modelValue: draft },
            })
          : mount(CustomSectionsEditor, {
              attachTo: document.body,
              props: { modelValue: draft.customSections },
            });
      const firstButton = wrapper.findAll('[data-move="1"]')[0]!;
      (firstButton.element as HTMLButtonElement).focus();
      await firstButton.trigger('click');
      await nextTick();
      expect(document.activeElement).toBe(
        wrapper.findAll('[data-move="1"]')[1]!.element,
      );
      (document.activeElement as HTMLButtonElement).click();
      await nextTick();
      expect(
        wrapper
          .findAll('fieldset input')
          .map((e) => (e.element as HTMLInputElement).value)
          .filter((v) => ['A', 'B', 'C'].includes(v)),
      ).toEqual(['B', 'C', 'A']);
      expect(document.activeElement).toBe(
        wrapper.findAll('fieldset')[2]!.find('input').element,
      );
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      await wrapper.findAll('button.danger')[0]!.trigger('click');
      expect(wrapper.findAll('fieldset')).toHaveLength(3);
      confirm.mockReturnValue(true);
      await wrapper.findAll('button.danger')[0]!.trigger('click');
      expect(wrapper.findAll('fieldset')).toHaveLength(2);
      expect(document.activeElement).toBe(
        wrapper.findAll('fieldset')[0]!.find('input').element,
      );
      wrapper.unmount();
      confirm.mockRestore();
    },
  );
  it('counts the representation that can actually prevent saving', () => {
    const draft = createEmptyContent();
    draft.schedule = Array.from({ length: 4 }, () => ({
      title: 'Н'.repeat(120),
      dayTime: 'В'.repeat(120),
      description: 'О'.repeat(749),
    }));
    expect(getCoreResponseLengths(draft).schedule).toBe(4003);
    expect(findOversizedContentResponse(draft)?.label).toBe('Расписание');
    draft.schedule[0]!.description = 'О'.repeat(746);
    expect(getCoreResponseLengths(draft).schedule).toBe(4000);
    expect(findOversizedContentResponse(draft)).toBeUndefined();
  });
});
