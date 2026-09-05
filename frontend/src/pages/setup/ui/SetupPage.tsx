import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderSetupPagePart1 } from './SetupPage.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './SetupPage.model';

export default function SetupPage($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <main
        {...$attributes}
        className={$class('setup-shell', $attributes.className)}
      >
        <header className="setup-header">
          <p className="eyebrow">{'Messenger Handoff'}</p>
          <h1>{'Настройка сервиса'}</h1>
          <p className="page-intro">
            {
              ' Подключите каналы и проверьте техническое состояние локального сервиса. '
            }
          </p>
        </header>
        {renderSetupPagePart1($state)}
      </main>
    </ModelScopeProvider>
  );
}
