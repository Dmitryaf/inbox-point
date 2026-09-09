import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderSetupPagePart1 } from './SetupPage.part1';
import { renderSetupPagePart2 } from './SetupPage.part2';
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
        {renderSetupPagePart1($state)}
        {renderSetupPagePart2($state)}
      </main>
    </ModelScopeProvider>
  );
}
