import '@frontend/pages/setup/styles/setup-page.react-data-r-ad468c1b.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import AdminPageHeader from '@frontend/widgets/admin-shell/ui/AdminPageHeader';

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
  const { logOut } = $state;
  const session = $unref($state.session);
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <main
        {...$attributes}
        className={$class('setup-shell', $attributes.className)}
        data-r-ad468c1b=""
      >
        {session.authenticated.value ? (
          <AdminPageHeader
            authenticated={session.authenticated.value}
            current="channels"
            intro="Сначала подключите Telegram для операторов, затем VK для сообщений клиентов."
            title="Каналы"
            onLogout={$callback(logOut)}
            data-r-ad468c1b=""
          />
        ) : null}
        {renderSetupPagePart1($state)}
      </main>
    </ModelScopeProvider>
  );
}
