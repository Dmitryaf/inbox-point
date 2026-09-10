import '@frontend/pages/not-found/styles/not-found-page.react-data-r-e17337c8.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderNotFoundPagePart1 } from './NotFoundPage.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './NotFoundPage.model';

export default function NotFoundPage($incomingProps: ComponentProps) {
  const { props: $props, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <main
        {...$attributes}
        className={$class('not-found-page', $attributes.className)}
        data-r-e17337c8=""
      >
        {renderNotFoundPagePart1()}
      </main>
    </ModelScopeProvider>
  );
}
