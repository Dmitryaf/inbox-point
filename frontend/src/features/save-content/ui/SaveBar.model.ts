import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';

export type ComponentProps = {
  dirty: boolean;
  saving: boolean;
  validationMessage: string;
  valid: boolean;
} & EventProps<{
  save: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  const statusMessage = computed(() => {
    if (props.saving) {
      return 'Сохраняем изменения…';
    }
    if (props.validationMessage) {
      return props.validationMessage;
    }
    if (props.dirty) {
      return 'Есть несохранённые изменения';
    }
    return 'Все изменения сохранены';
  });
  return { $emit, statusMessage };
}
