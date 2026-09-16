import { unref as $unref } from '@frontend/shared/lib/model-state';

import {
  actionButtonLabel,
  canRetryHeldReply,
} from '@frontend/widgets/operations-overview/model/operator-action-presentation';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperatorRelayIncidentActions.model';
export function renderOperatorRelayIncidentActionsPart4(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      {$unref(canRetryHeldReply)($props.incident) ? (
        <button
          type="button"
          disabled={Boolean($props.pendingActionId)}
          onClick={() => void $emit('resolve', $props.incident.id, 'retry')}
          data-r-464ae559=""
        >
          {$unref(actionButtonLabel)(
            $props.pendingActionId === $props.incident.id,
            'Повторить открытие темы',
          )}
        </button>
      ) : null}
    </>
  );
}
