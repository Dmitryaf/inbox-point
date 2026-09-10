import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type { OperationsStatus } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  outbound: OperationsStatus['outbound'];
  pending: 'pause' | 'resume' | undefined;
} & EventProps<{
  change: [mode: 'pause' | 'resume'];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  return { $emit };
}
