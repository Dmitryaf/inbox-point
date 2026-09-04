import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { classNames as $class } from '@manage/shared/lib/component-view';
import { invokeHandler as $invoke } from '@manage/shared/lib/component-events';
import { unref as $unref } from '@manage/shared/lib/model-state';

import { inheritedAttributes } from '@manage/shared/lib/component-attributes';

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
        {renderContentManagementPagePart1($state)}
      </div>
    </ModelScopeProvider>
  );
}
