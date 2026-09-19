import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ScheduleItemFields.model';
export function renderScheduleItemFieldsPart4(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { move } = $state;
  const draft = $state.draft.value;

  return (
    <>
      <div className="item-actions" data-r-f3bf3992="">
        <button
          type="button"
          disabled={$props.index === 0}
          aria-label={`Переместить направление ${$props.index + 1} выше`}
          onClick={() => void move(-1)}
          className="quiet"
          data-r-f3bf3992=""
        >
          {' Выше '}
        </button>
        <button
          type="button"
          disabled={$props.index === draft.schedule.length - 1}
          aria-label={`Переместить направление ${$props.index + 1} ниже`}
          onClick={() => void move(1)}
          className="quiet"
          data-r-f3bf3992=""
        >
          {' Ниже '}
        </button>
        <button
          type="button"
          onClick={() =>
            void $required($state.draft.value).schedule.splice($props.index, 1)
          }
          className="danger"
          data-r-f3bf3992=""
        >
          {' Удалить '}
        </button>
      </div>
    </>
  );
}
