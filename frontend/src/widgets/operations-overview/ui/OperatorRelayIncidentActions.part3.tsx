import { unref as $unref } from '@frontend/shared/lib/model-state';

import {
  actionButtonLabel,
  isLifecycle,
  lifecycleResolutionLabel,
} from '@frontend/widgets/operations-overview/model/operator-action-presentation';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperatorRelayIncidentActions.model';
export function renderOperatorRelayIncidentActionsPart3(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      {$unref(isLifecycle)($props.incident) &&
      $props.incident.status === 'outcome_unknown' ? (
        <button
          type="button"
          disabled={Boolean($props.pendingActionId)}
          onClick={() =>
            void $emit('resolve', $props.incident.id, 'not_completed')
          }
          data-r-464ae559=""
        >
          {$unref(actionButtonLabel)(
            $props.pendingActionId === $props.incident.id,
            $unref(lifecycleResolutionLabel)($props.incident, 'not_completed'),
          )}
        </button>
      ) : null}
    </>
  );
}
