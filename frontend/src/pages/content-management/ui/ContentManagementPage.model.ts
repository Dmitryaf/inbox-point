import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { useAdminShellSession } from '@frontend/features/admin-auth/model/admin-session-context';

export type ComponentProps = EventProps<{
  dirtyChange: [dirty: boolean];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const session = useAdminShellSession();
  const emit = $emit;
  return { session, emit };
}
