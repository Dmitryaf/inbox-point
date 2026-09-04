import { invokeArgs as $invokeArgs } from '@manage/shared/lib/component-events';
import { unref as $unref } from '@manage/shared/lib/model-state';
import {
  modelSetter as $setter,
  requiredValue as $required,
} from '@manage/shared/lib/component-bindings';

import LoginForm from '@manage/features/authenticate/ui/LoginForm';
import AsyncMessage from '@manage/shared/ui/AsyncMessage';
import ContentWorkspace from '@manage/widgets/content-workspace/ui/ContentWorkspace';

import type { createComponentModel } from './ContentManagementPage.model';
export function renderContentManagementPagePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const session = $unref($state.session);
  return (
    <>
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
    </>
  );
}
