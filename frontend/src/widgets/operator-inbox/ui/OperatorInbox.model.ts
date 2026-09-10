import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { useOperatorInbox } from '@frontend/features/manage-operator-inbox/model/use-operator-inbox';

export type ComponentProps = {
  onUnauthorized: () => void;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  _emit: (event: string, ...args: unknown[]) => void,
  _model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
  $expose: (value: Record<string, unknown>) => void,
) {
  const props = $props;
  const inbox = useOperatorInbox(props.onUnauthorized);
  $expose({ refresh: inbox.refresh });
  return { inbox };
}
