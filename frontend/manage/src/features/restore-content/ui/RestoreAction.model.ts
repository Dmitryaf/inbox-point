import {
  type EventProps,
  type ComponentAttributes,
} from '@manage/shared/lib/component-model';

import { ref } from '@manage/shared/lib/model-state';

export type ComponentProps = {
  pending: boolean;
  revision: number;
} & EventProps<{ restore: [revision: number] }> &
  ComponentAttributes;
export const componentDefaults = {};
export function createComponentModel(
  $props: ComponentProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  const emit = $emit;
  const confirming = ref(false);
  return { props, emit, confirming };
}
