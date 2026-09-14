import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './AdminPageHeader.model';
export function renderAdminPageHeaderPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      {$props.showLogout ? (
        <div className="admin-session-actions" data-r-e15afcb7="">
          <button
            disabled={$props.pending}
            type="button"
            onClick={() => void $emit('revokeAll')}
            className="quiet"
            data-r-e15afcb7=""
          >
            {' Выйти везде '}
          </button>
          <button
            disabled={$props.pending}
            type="button"
            onClick={() => void $emit('logout')}
            className="quiet"
            data-r-e15afcb7=""
          >
            {' Выйти '}
          </button>
        </div>
      ) : null}
    </>
  );
}
