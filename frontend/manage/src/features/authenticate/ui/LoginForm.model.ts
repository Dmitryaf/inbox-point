import {
  type EventProps,
  type ComponentAttributes,
} from '@manage/shared/lib/component-model';

import { ref } from '@manage/shared/lib/model-state';

export type ComponentProps = { pending: boolean } & EventProps<{
  submit: [password: string];
}> &
  ComponentAttributes;
export const componentDefaults = {};
export function createComponentModel(
  $props: ComponentProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  const emit = $emit;
  const password = ref('');
  function submit(): void {
    if (!password.value || props.pending) {
      return;
    }
    emit('submit', password.value);
    password.value = '';
  }
  return { password, submit };
}
