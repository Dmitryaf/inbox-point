import { classNames as $class } from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
export function renderTelegramSetupCardPart1(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <header className="setup-card-heading" data-r-44d690ea="">
        <div data-r-44d690ea="">
          <h2 id="telegram-setup-title" data-r-44d690ea="">
            {'Telegram'}
          </h2>
          <p data-r-44d690ea="">
            {'Бот для клиентов и группа, где сотрудники отвечают на вопросы.'}
          </p>
        </div>
        <span
          className={$class(
            'status-pill',
            $props.status.connected
              ? 'status-pill--healthy'
              : 'status-pill--neutral',
          )}
          data-r-44d690ea=""
        >
          {$props.status.connected ? 'Подключён' : 'Не подключён'}
        </span>
      </header>
    </>
  );
}
