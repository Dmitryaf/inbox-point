import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type { ContentChange } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  changes: ContentChange[];
  hasUnsavedChanges: boolean;
  restoring: boolean;
} & EventProps<{ restore: [revision: number] }> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  return { $emit };
}
