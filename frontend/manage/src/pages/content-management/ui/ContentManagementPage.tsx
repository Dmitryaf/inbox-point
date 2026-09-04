import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { classNames as $class } from '@manage/shared/lib/component-view';
import {
  invokeHandler as $invoke,
  invokeArgs as $invokeArgs,
} from '@manage/shared/lib/component-events';
import { unref as $unref } from '@manage/shared/lib/model-state';
import {
  modelSetter as $setter,
  requiredValue as $required,
} from '@manage/shared/lib/component-bindings';
import { inheritedAttributes } from '@manage/shared/lib/component-attributes';

import LoginForm from '@manage/features/authenticate/ui/LoginForm';
import AsyncMessage from '@manage/shared/ui/AsyncMessage';
import ContentWorkspace from '@manage/widgets/content-workspace/ui/ContentWorkspace';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentManagementPage.model';

export default function ContentManagementPage($incomingProps: ComponentProps) {
  const $attributes = inheritedAttributes($incomingProps);
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { logOut } = $state;
  const session = $unref($state.session);

  return (
    <ModelScopeProvider scope={$scope}>
      <div {...$attributes} className={$class('shell', $attributes.className)}>
        <header className="hero">
          <div>
            <p className="eyebrow">{'Messenger Handoff'}</p>
            <h1>{'Информация для клиентов'}</h1>
            <p>{'Обновите ответы, которые клиенты видят в Telegram и VK.'}</p>
          </div>
          {session.authenticated.value ? (
            <button
              type="button"
              onClick={($event) => {
                $invoke(logOut, $event);
              }}
              className="quiet"
            >
              {' Выйти '}
            </button>
          ) : null}
        </header>
        {session.booting.value ? (
          <p role="status" className="state-card">
            {' Открываем редактор… '}
          </p>
        ) : (
          <main>
            <AsyncMessage kind="error" text={session.error.value} />
            {!session.authenticated.value ? (
              <LoginForm
                pending={session.pending.value}
                onSubmit={(...$args) => {
                  $invokeArgs(
                    $required($unref($state.session)).authenticate,
                    $args,
                  );
                }}
              />
            ) : (
              <ContentWorkspace
                onDirtyChange={$setter($state, 'hasUnsavedChanges')}
                onUnauthorized={(...$args) => {
                  $invokeArgs(
                    $required($unref($state.session)).expireSession,
                    $args,
                  );
                }}
              />
            )}
          </main>
        )}
      </div>
    </ModelScopeProvider>
  );
}
