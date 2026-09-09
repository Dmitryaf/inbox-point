import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  requiredValue as $required,
  logicalOr as $or,
} from '@frontend/shared/lib/component-bindings';

import AdminLoginForm from '@frontend/features/admin-auth/ui/AdminLoginForm';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import { renderSetupPagePart3 } from './SetupPage.part3';

import type { createComponentModel } from './SetupPage.model';
export function renderSetupPagePart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const session = $unref($state.session);
  const error = $state.error.value;
  if (!!session.booting.value) {
    return null;
  }
  return (
    <>
      {!session.authenticated.value ? (
        <section className="auth-panel">
          <div className="auth-stack">
            <AsyncMessage kind="error" text={session.error.value} />
            <AdminLoginForm
              pending={session.pending.value}
              onSubmit={$callback(
                $required($unref($state.session)).authenticate,
              )}
            />
          </div>
        </section>
      ) : (
        <>
          <AsyncMessage
            kind="error"
            text={$or(session.error.value, () => error)}
          />
          {renderSetupPagePart3($state)}
        </>
      )}
    </>
  );
}
