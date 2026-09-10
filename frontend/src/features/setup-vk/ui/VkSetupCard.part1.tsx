import { classNames as $class } from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type { ComponentProps, componentDefaults } from './VkSetupCard.model';
export function renderVkSetupCardPart1(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <header className="setup-card-heading" data-r-712bbad4="">
        <div data-r-712bbad4="">
          <h2 id="vk-setup-title" data-r-712bbad4="">
            {'VK'}
          </h2>
          <p data-r-712bbad4="">
            {'Сообщество, из которого приходят сообщения клиентов.'}
          </p>
        </div>
        <span
          className={$class(
            'status-pill',
            $props.status.connected
              ? 'status-pill--healthy'
              : 'status-pill--neutral',
          )}
          data-r-712bbad4=""
        >
          {$props.status.connected ? 'Подключён' : 'Не подключён'}
        </span>
      </header>
    </>
  );
}
