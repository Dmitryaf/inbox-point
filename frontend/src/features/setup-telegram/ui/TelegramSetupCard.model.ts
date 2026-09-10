import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { ref } from '@frontend/shared/lib/model-state';
import type { ChannelSetupStatus } from '@frontend/entities/setup/model/types';

export type ComponentProps = {
  status: ChannelSetupStatus;
} & EventProps<{
  connected: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const expanded = ref(false);
  return { $emit, expanded };
}
