import '@frontend/pages/admin-login/styles/admin-login-page.react-data-r-3fb97507.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderAdminLoginPagePart1 } from './AdminLoginPage.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './AdminLoginPage.model';

export default function AdminLoginPage($incomingProps: ComponentProps) {
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
        className={$class('login-page', $attributes.className)}
        data-r-3fb97507=""
      >
        {renderAdminLoginPagePart1($state)}
      </main>
    </ModelScopeProvider>
  );
}
