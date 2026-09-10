import '@frontend/pages/setup/styles/setup-page.react-data-r-ad468c1b.css';
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
      <section
        {...$attributes}
        className={$class('setup-page', $attributes.className)}
        data-r-ad468c1b=""
      >
        {renderSetupPagePart1($state)}
      </section>
    </ModelScopeProvider>
  );
}
