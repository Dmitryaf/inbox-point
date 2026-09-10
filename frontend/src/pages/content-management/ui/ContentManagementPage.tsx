import '@frontend/pages/content-management/styles/content-management-page.react-data-r-5179b381.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import AdminPageHeader from '@frontend/widgets/admin-shell/ui/AdminPageHeader';

import { renderContentManagementPagePart1 } from './ContentManagementPage.part1';
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
  const { logOut } = $state;
  const session = $unref($state.session);
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <div
        {...$attributes}
        className={$class('shell', $attributes.className)}
        data-r-5179b381=""
      >
        {session.authenticated.value ? (
          <AdminPageHeader
            authenticated={session.authenticated.value}
            current="information"
            intro="Настройте готовые ответы для Telegram и VK."
            title="Информация"
            onLogout={$callback(logOut)}
            data-r-5179b381=""
          />
        ) : null}
        {renderContentManagementPagePart1($state)}
      </div>
    </ModelScopeProvider>
  );
}
