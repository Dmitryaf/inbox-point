import { invokeArgs as $invokeArgs } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  modelSetter as $setter,
  requiredValue as $required,
} from '@frontend/shared/lib/component-bindings';

import LoginForm from '@frontend/features/management-auth/ui/LoginForm';
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
        <p role="status" className="state-card">
          {' Открываем редактор… '}
        </p>
      ) : (
        <main>
          {!session.authenticated.value ? (
            <section className="auth-panel">
              <div className="auth-stack">
                <AsyncMessage kind="error" text={session.error.value} />
                <LoginForm
                  pending={session.pending.value}
                  onSubmit={(...$args) => {
                    $invokeArgs(
                      $required($unref($state.session)).authenticate,
                      $args,
                    );
                  }}
                />
              </div>
            </section>
          ) : null}
          {session.authenticated.value ? (
            <>
              <AsyncMessage kind="error" text={session.error.value} />
            </>
          ) : null}
          {workspaceActivated ? (
            <div
              style={Object.assign(
                {},
                { display: session.authenticated.value ? undefined : 'none' },
              )}
            >
              <ContentWorkspace
                authenticated={session.authenticated.value}
                onDirtyChange={$setter($state, 'hasUnsavedChanges')}
                onUnauthorized={(...$args) => {
                  $invokeArgs(
                    $required($unref($state.session)).expireSession,
                    $args,
                  );
                }}
              />
            </div>
          ) : null}
        </main>
      )}
    </>
  );
}
