import type { DOMWrapper } from '@test/frontend/support/react-test-utils';

import { response } from '@test/frontend/support/fake-response';

export const initialVersion = 'a'.repeat(64);

export function contentResponse(schedule: string) {
  return response({ content: { schedule }, version: initialVersion });
}

export function serviceControlResponse() {
  return response({
    channels: {
      telegram: { mode: 'active' },
      vk: { mode: 'active' },
    },
  });
}

export function findButton(buttons: DOMWrapper<Element>[], label: string) {
  const button = buttons.find((candidate) => candidate.text() === label);
  if (!button) {
    throw new Error(`Expected the "${label}" button`);
  }
  return button;
}
