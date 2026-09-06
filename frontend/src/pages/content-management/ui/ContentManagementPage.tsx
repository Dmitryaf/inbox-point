import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderContentManagementPagePart1 } from './ContentManagementPage.part1';
import { renderContentManagementPagePart2 } from './ContentManagementPage.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentManagementPage.model';

export default function ContentManagementPage($incomingProps: ComponentProps) {
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
      <div {...$attributes} className={$class('shell', $attributes.className)}>
        {renderContentManagementPagePart1($state)}
        {renderContentManagementPagePart2($state)}
      </div>
    </ModelScopeProvider>
  );
}
