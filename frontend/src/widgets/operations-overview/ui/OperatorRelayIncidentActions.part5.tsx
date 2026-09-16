import { unref as $unref } from '@frontend/shared/lib/model-state';

import {
  actionButtonLabel,
  canUseWeb,
} from '@frontend/widgets/operations-overview/model/operator-action-presentation';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperatorRelayIncidentActions.model';
export function renderOperatorRelayIncidentActionsPart5(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      {$unref(canUseWeb)($props.incident) ? (
        <button
          type="button"
          disabled={Boolean($props.pendingActionId)}
          onClick={() => void $emit('resolve', $props.incident.id, 'use_web')}
          data-r-464ae559=""
        >
          {$unref(actionButtonLabel)(
            $props.pendingActionId === $props.incident.id,
            'Открыть обращение здесь',
          )}
        </button>
      ) : null}
    </>
  );
}
