import '@frontend/widgets/operations-overview/styles/connection-setup-guide.react-data-r-cf5827f2.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { RouterLink } from '@frontend/shared/lib/router';

import { renderConnectionSetupGuidePart1 } from './ConnectionSetupGuide.part1';
import { renderConnectionSetupGuidePart2 } from './ConnectionSetupGuide.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ConnectionSetupGuide.model';

export default function ConnectionSetupGuide($incomingProps: ComponentProps) {
  const { props: $props, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="connection-guide-title"
        className={$class('connection-guide', $attributes.className)}
        data-r-cf5827f2=""
      >
        {renderConnectionSetupGuidePart1($props)}
        {renderConnectionSetupGuidePart2($props)}
        <RouterLink
          to="/setup"
          className="connection-guide-action"
          data-r-cf5827f2=""
        >
          {' Начать подключение '}
        </RouterLink>
        <p className="connection-guide-note" data-r-cf5827f2="">
          {
            ' На следующей странице будут подробные шаги. Команды сервера и ручной поиск идентификаторов не понадобятся. '
          }
        </p>
      </section>
    </ModelScopeProvider>
  );
}
