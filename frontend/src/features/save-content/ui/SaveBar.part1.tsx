import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './SaveBar.model';
export function renderSaveBarPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      <button
        disabled={$or($props.saving, () => !$props.dirty)}
        type="button"
        onClick={() => void $emit('save')}
        data-r-80a75b00=""
      >
        {$props.saving
          ? 'Сохраняем…'
          : !$props.valid && $props.dirty
            ? 'Исправить поля'
            : 'Сохранить'}
      </button>
    </>
  );
}
