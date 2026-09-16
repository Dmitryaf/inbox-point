import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import {
  type OperatorRelayIncidentListEmits,
  type OperatorRelayIncidentListProps,
} from '@frontend/widgets/operations-overview/model/operator-action-presentation';

export type ComponentProps = (Pick<
  OperatorRelayIncidentListProps,
  'pendingActionId'
> & {
  incident: OperatorRelayIncidentListProps['incidents'][number];
}) &
  EventProps<OperatorRelayIncidentListEmits> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  return { $emit };
}
