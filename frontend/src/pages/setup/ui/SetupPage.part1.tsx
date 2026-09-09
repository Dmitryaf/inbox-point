import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import type { createComponentModel } from './SetupPage.model';
export function renderSetupPagePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const session = $unref($state.session);

  return (
    <>
      <header className="setup-header">
        <div>
          <p className="eyebrow">{'Messenger Handoff'}</p>
          <h1>{'Настройка сервиса'}</h1>
          <p className="page-intro">{'Подключите Telegram и VK.'}</p>
        </div>
        {session.authenticated.value ? (
          <button
            type="button"
            onClick={$nativeHandler(
              $required($unref($state.session)).endSession,
            )}
            className="secondary-button"
          >
            {' Выйти '}
          </button>
        ) : null}
      </header>
    </>
  );
}
