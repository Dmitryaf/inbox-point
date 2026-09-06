import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';

import type { createComponentModel } from './ContentManagementPage.model';
export function renderContentManagementPagePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { logOut } = $state;
  const session = $unref($state.session);

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">{'Messenger Handoff'}</p>
          <h1>{'Информация для клиентов'}</h1>
          <p>{'Обновите ответы, которые клиенты видят в Telegram и VK.'}</p>
        </div>
        {session.authenticated.value ? (
          <button
            type="button"
            onClick={$nativeHandler(logOut)}
            className="secondary-button"
          >
            {' Выйти '}
          </button>
        ) : null}
      </header>
    </>
  );
}
