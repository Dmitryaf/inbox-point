import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
export function renderTelegramSetupCardPart4(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { disconnect } = $state;
  const expanded = $state.expanded.value;
  const disconnecting = $state.disconnecting.value;
  const disconnectError = $state.disconnectError.value;
  if (!expanded) {
    return null;
  }
  if (!($props.status.source !== 'none')) {
    return null;
  }
  return (
    <>
      {$props.status.source === 'environment' ? (
        <p className="setup-status setup-status--info" data-r-44d690ea="">
          {' Управляется на сервере. '}
        </p>
      ) : (
        <>
          {$props.vkConfigured ? (
            <p className="setup-status setup-status--info" data-r-44d690ea="">
              {' Чтобы отключить Telegram, сначала отключите VK. '}
            </p>
          ) : null}
          <button
            type="button"
            disabled={$or(disconnecting, () => $props.vkConfigured)}
            onClick={$nativeHandler(disconnect)}
            className="danger"
            data-r-44d690ea=""
          >
            {disconnecting ? 'Отключаем…' : 'Отключить Telegram'}
          </button>
          {disconnectError ? (
            <p
              role="alert"
              className="setup-status setup-status--error"
              data-r-44d690ea=""
            >
              {disconnectError}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
