import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@manage/shared/lib/component-model';

import { ref } from '@manage/shared/lib/model-state';

export type ComponentProps = { pending: boolean } & EventProps<{
  submit: [password: string];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
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
