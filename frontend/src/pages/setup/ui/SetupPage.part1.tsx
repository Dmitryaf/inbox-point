import { unref as $unref } from '@frontend/shared/lib/model-state';
import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import { renderSetupPagePart2 } from './SetupPage.part2';

import type { createComponentModel } from './SetupPage.model';
export function renderSetupPagePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const session = $unref($state.session);
  const error = $state.error.value;

  return (
    <>
      {session.booting.value ? (
        <p role="status" className="state-card card" data-r-ad468c1b="">
          {' Проверяем доступ… '}
        </p>
      ) : session.authenticated.value ? (
        <>
          <AsyncMessage
            kind="error"
            text={$or(session.error.value, () => error)}
            data-r-ad468c1b=""
          />
          {renderSetupPagePart2($state)}
        </>
      ) : null}
    </>
  );
}
