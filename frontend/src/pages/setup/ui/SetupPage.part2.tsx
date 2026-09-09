import { unref as $unref } from '@frontend/shared/lib/model-state';

import { renderSetupPagePart3 } from './SetupPage.part3';

import type { createComponentModel } from './SetupPage.model';
export function renderSetupPagePart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const session = $unref($state.session);

  return (
    <>
      {session.booting.value ? (
        <p role="status" className="state-card">
          {' Проверяем доступ… '}
        </p>
      ) : (
        <>{renderSetupPagePart3($state)}</>
      )}
    </>
  );
}
