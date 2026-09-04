import {
  type EventProps,
  type ComponentAttributes,
} from '@manage/shared/lib/component-model';

import type { ContentChange } from '@manage/entities/content/model/types';

export type ComponentProps = {
  changes: ContentChange[];
  restoring: boolean;
} & EventProps<{ restore: [revision: number] }> &
  ComponentAttributes;
export const componentDefaults = {};
export function createComponentModel(
  $props: ComponentProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  return { $emit };
}
