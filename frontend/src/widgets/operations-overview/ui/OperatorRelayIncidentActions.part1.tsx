import { unref as $unref } from '@frontend/shared/lib/model-state';

import { actionButtonLabel } from '@frontend/widgets/operations-overview/model/operator-action-presentation';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperatorRelayIncidentActions.model';
export function renderOperatorRelayIncidentActionsPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      {$props.incident.action === 'relay_message' &&
      $props.incident.confirmable ? (
        <button
          type="button"
          disabled={Boolean($props.pendingActionId)}
          onClick={() => void $emit('resolve', $props.incident.id, 'received')}
          className="secondary-button"
          data-r-464ae559=""
        >
          {$unref(actionButtonLabel)(
            $props.pendingActionId === $props.incident.id,
            'Сообщение есть в Telegram',
          )}
        </button>
      ) : null}
    </>
  );
}
