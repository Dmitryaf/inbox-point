import { dynamicComponent as $dynamic } from '@frontend/shared/lib/component-view';
import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { modelSetter as $setter } from '@frontend/shared/lib/component-bindings';

import { RouterView } from '@frontend/shared/lib/router';

import AdminPageHeader from './AdminPageHeader';

import type { createComponentModel } from './AdminShell.model';
export function renderAdminShellPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { logOut, revokeAll } = $state;
  const session = $unref($state.session);
  const current = $state.current.value;
  const intro = $state.intro.value;
  const title = $state.title.value;

  return (
    <>
      {session.booting.value ? (
        <div role="status" className="admin-shell-state" data-r-2be24c3c="">
          {' Проверяем доступ… '}
        </div>
      ) : session.authenticated.value ? (
        <>
          <AdminPageHeader
            current={current}
            intro={intro}
            pending={session.pending.value}
            showLogout={session.mode.value === 'password'}
            title={title}
            onLogout={$callback(logOut)}
            onRevokeAll={$callback(revokeAll)}
            data-r-2be24c3c=""
          />
          <main className="admin-shell-content" data-r-2be24c3c="">
            {session.error.value ? (
              <p
                role="alert"
                className="message message--error"
                data-r-2be24c3c=""
              >
                {session.error.value}
              </p>
            ) : null}
            <RouterView
              data-r-2be24c3c=""
              slots={{
                default: ({ Component }) => (
                  <>
                    {$dynamic(
                      Component,
                      {
                        onDirtyChange: $setter($state, 'dirty'),
                        'data-r-2be24c3c': '',
                      },
                      <></>,
                    )}
                  </>
                ),
              }}
            />
          </main>
        </>
      ) : null}
    </>
  );
}
