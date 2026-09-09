import { unref as $unref } from '@frontend/shared/lib/model-state';

import { renderSetupPagePart2 } from './SetupPage.part2';

import type { createComponentModel } from './SetupPage.model';
export function renderSetupPagePart1(
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
        <>{renderSetupPagePart2($state)}</>
      )}
    </>
  );
}
