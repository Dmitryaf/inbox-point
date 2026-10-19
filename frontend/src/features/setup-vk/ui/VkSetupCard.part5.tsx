import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './VkSetupCard.model';
export function renderVkSetupCardPart5(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const messageKind = $unref($state.messageKind);
  const message = $unref($state.message);
  const disconnecting = $unref($state.disconnecting);
  const expanded = $state.expanded.value;
  if (!expanded) {
    return null;
  }
  if (!($props.status.source !== 'none')) {
    return null;
  }
  return (
    <>
      {$props.status.source === 'environment' ? (
        <p className="setup-status setup-status--info" data-r-712bbad4="">
          {' Управляется на сервере. '}
        </p>
      ) : (
        <>
          <button
            type="button"
            disabled={disconnecting}
            onClick={$nativeHandler($unref($state.disconnect))}
            className="danger"
            data-r-712bbad4=""
          >
            {disconnecting ? 'Отключаем…' : 'Отключить VK'}
          </button>
          {messageKind === 'error' ? (
            <p
              role="alert"
              className="setup-status setup-status--error"
              data-r-712bbad4=""
            >
              {message}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
