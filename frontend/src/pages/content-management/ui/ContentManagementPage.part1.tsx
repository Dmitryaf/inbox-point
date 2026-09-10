import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  modelSetter as $setter,
  requiredValue as $required,
} from '@frontend/shared/lib/component-bindings';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import ContentWorkspace from '@frontend/widgets/content-workspace/ui/ContentWorkspace';

import type { createComponentModel } from './ContentManagementPage.model';
export function renderContentManagementPagePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const session = $unref($state.session);
  const workspaceActivated = $state.workspaceActivated.value;

  return (
    <>
      {session.booting.value ? (
        <p role="status" className="state-card card" data-r-5179b381="">
          {' Открываем редактор… '}
        </p>
      ) : session.authenticated.value ? (
        <main data-r-5179b381="">
          <AsyncMessage
            kind="error"
            text={session.error.value}
            data-r-5179b381=""
          />
          {workspaceActivated ? (
            <div
              style={Object.assign(
                {},
                { display: session.authenticated.value ? undefined : 'none' },
              )}
              data-r-5179b381=""
            >
              <ContentWorkspace
                authenticated={session.authenticated.value}
                onDirtyChange={$setter($state, 'hasUnsavedChanges')}
                onUnauthorized={$callback(
                  $required($unref($state.session)).expireSession,
                )}
                data-r-5179b381=""
              />
            </div>
          ) : null}
        </main>
      ) : null}
    </>
  );
}
