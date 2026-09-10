import TelegramConnectionForm from './TelegramConnectionForm';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
export function renderTelegramSetupCardPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;
  const expanded = $state.expanded.value;

  return (
    <>
      {expanded ? (
        <div className="setup-details" data-r-44d690ea="">
          {$props.status.connected ? (
            <p
              role="status"
              className="setup-status setup-status--success"
              data-r-44d690ea=""
            >
              {
                ' Подключение активно. Изменить секреты можно через конфигурацию установки. '
              }
            </p>
          ) : (
            <TelegramConnectionForm
              locked={$props.status.locked}
              onConnected={() => void $emit('connected')}
              data-r-44d690ea=""
            />
          )}
        </div>
      ) : null}
    </>
  );
}
