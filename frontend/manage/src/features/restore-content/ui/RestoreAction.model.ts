import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@manage/shared/lib/component-model';

import { ref } from '@manage/shared/lib/model-state';

export type ComponentProps = {
  hasUnsavedChanges: boolean;
  pending: boolean;
  revision: number;
} & EventProps<{ restore: [revision: number] }> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  const emit = $emit;
  const confirming = ref(false);
  return { props, emit, confirming };
}
