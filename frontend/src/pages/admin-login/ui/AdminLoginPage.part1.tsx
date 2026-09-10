import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import AdminLoginForm from '@frontend/features/admin-auth/ui/AdminLoginForm';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import type { createComponentModel } from './AdminLoginPage.model';
export function renderAdminLoginPagePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { authenticate } = $state;
  const session = $unref($state.session);
  const loginMessage = $state.loginMessage.value;

  return (
    <>
      <div className="login-stack" data-r-3fb97507="">
        <p className="login-brand" data-r-3fb97507="">
          {'Inbox Point'}
        </p>
        <AsyncMessage
          kind="error"
          text={$or(session.error.value, () => loginMessage)}
          data-r-3fb97507=""
        />
        {session.booting.value ? (
          <p role="status" className="login-state" data-r-3fb97507="">
            {' Проверяем доступ… '}
          </p>
        ) : (
          <AdminLoginForm
            pending={session.pending.value}
            onSubmit={$callback(authenticate)}
            data-r-3fb97507=""
          />
        )}
      </div>
    </>
  );
}
