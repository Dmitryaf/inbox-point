import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { ref } from '@frontend/shared/lib/model-state';

export type ComponentProps = {
  pending: boolean;
} & EventProps<{
  submit: [password: string, rememberDevice: boolean];
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
  const rememberDevice = ref(false);
  function submit(): void {
    if (!password.value || props.pending) {
      return;
    }
    emit('submit', password.value, rememberDevice.value);
    password.value = '';
  }
  return { password, rememberDevice, submit };
}
