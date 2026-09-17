import AppIcon from '@frontend/shared/ui/AppIcon';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './ConnectionSetupGuide.model';
export function renderConnectionSetupGuidePart1(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <header className="connection-guide-heading" data-r-cf5827f2="">
        <span
          aria-hidden="true"
          className="connection-guide-icon"
          data-r-cf5827f2=""
        >
          <AppIcon name="channel" data-r-cf5827f2="" />
        </span>
        <div data-r-cf5827f2="">
          <h3 id="connection-guide-title" data-r-cf5827f2="">
            {$props.problems.length > 1
              ? 'Подключите каналы по порядку'
              : 'Подключите канал'}
          </h3>
          {$props.problems.length > 1 ? (
            <p data-r-cf5827f2="">
              {
                ' Сначала настройте Telegram — там будут работать администраторы. Затем подключите VK как второй канал для клиентов. '
              }
            </p>
          ) : (
            <p data-r-cf5827f2="">
              {'Ниже указан оставшийся шаг и то, что потребуется.'}
            </p>
          )}
        </div>
      </header>
    </>
  );
}
