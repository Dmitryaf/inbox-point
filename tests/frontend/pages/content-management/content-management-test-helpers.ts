import type { DOMWrapper, VueWrapper } from '@vue/test-utils';

import { response } from '@test/frontend/support/fake-response';

export const initialVersion = 'a'.repeat(64);

export function contentResponse(schedule: string) {
  return response({
    content: groupContent(schedule),
    version: initialVersion,
  });
}

export function findButton(buttons: DOMWrapper<Element>[], label: string) {
  const button = buttons.find((candidate) => candidate.text() === label);
  if (!button) {
    throw new Error(`Expected the "${label}" button`);
  }
  return button;
}

export function groupContent(name: string, time = 'Понедельник, 19:00') {
  return {
    schedule: '',
    scheduleItems: [],
    directions: [{ id: 'dance', name: 'Танец' }],
    groups: [
      {
        id: 'group',
        directionId: 'dance',
        name,
        meetings: [time],
        description: '',
        enrollmentOpen: false,
        applicationQuestion: '',
      },
    ],
    keywords: [],
  };
}
export async function openGroup(wrapper: Pick<VueWrapper, 'find'>) {
  if (wrapper.find('#group-name-group').exists()) {
    return;
  }
  const direction = wrapper.find('.class-list-item');
  if (!direction.exists()) {
    return;
  }
  await direction.trigger('click');
  const group = wrapper.find('.class-list-item');
  if (group.exists()) {
    await group.trigger('click');
  }
}
