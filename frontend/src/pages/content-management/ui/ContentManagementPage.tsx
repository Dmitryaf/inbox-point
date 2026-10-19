import '@frontend/pages/content-management/styles/content-management-page.react-data-r-5179b381.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { eventCallback as $callback } from '@frontend/shared/lib/component-events';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import ContentWorkspace from '@frontend/widgets/content-workspace/ui/ContentWorkspace';

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
  const session = $unref($state.session);
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        className={$class('content-management-page', $attributes.className)}
        data-r-5179b381=""
      >
        <ContentWorkspace
          authenticated={session.authenticated.value}
          onDirtyChange={($event) =>
            void $unref($state.emit)('dirtyChange', $event)
          }
          onUnauthorized={$callback(
            $required($unref($state.session)).expireSession,
          )}
          data-r-5179b381=""
        />
      </section>
    </ModelScopeProvider>
  );
}
