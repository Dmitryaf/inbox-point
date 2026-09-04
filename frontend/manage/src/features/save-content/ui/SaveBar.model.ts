import {
  type EventProps,
  type ComponentAttributes,
} from '@manage/shared/lib/component-model';

export type ComponentProps = { dirty: boolean; saving: boolean } & EventProps<{
  save: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
export function createComponentModel(
  $props: ComponentProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  return { $emit };
}
