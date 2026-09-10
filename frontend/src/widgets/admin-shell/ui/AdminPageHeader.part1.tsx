import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './AdminPageHeader.model';
export function renderAdminPageHeaderPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      <div className="admin-header-row" data-r-e15afcb7="">
        <div className="admin-title-block" data-r-e15afcb7="">
          <p className="eyebrow" data-r-e15afcb7="">
            {'Messenger Handoff'}
          </p>
          <h1 data-r-e15afcb7="">{$props.title}</h1>
        </div>
        {$props.authenticated ? (
          <button
            type="button"
            onClick={() => void $emit('logout')}
            className="secondary-button"
            data-r-e15afcb7=""
          >
            {' Выйти '}
          </button>
        ) : null}
      </div>
    </>
  );
}
