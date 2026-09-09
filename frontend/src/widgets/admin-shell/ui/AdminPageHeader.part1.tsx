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
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">{'Messenger Handoff'}</p>
          <h1>{$props.title}</h1>
          <p className="page-intro">{$props.intro}</p>
        </div>
        {$props.authenticated ? (
          <button
            type="button"
            onClick={() => void $emit('logout')}
            className="secondary-button"
          >
            {' Выйти '}
          </button>
        ) : null}
      </div>
    </>
  );
}
