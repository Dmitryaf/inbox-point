import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ScheduleItemFields.model';
export function renderScheduleItemFieldsPart3(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const item = $state.item.value;

  return (
    <>
      <textarea
        id={`schedule-description-${$props.index}`}
        aria-describedby={
          $props.errors[`schedule-description-${$props.index}`]
            ? `schedule-description-${$props.index}-error`
            : undefined
        }
        aria-invalid={Boolean(
          $props.errors[`schedule-description-${$props.index}`],
        )}
        maxLength={1000}
        rows={3}
        value={item.description ?? ''}
        onChange={$textProperty(() => $state.item.value, 'description')}
        data-r-f3bf3992=""
      />
    </>
  );
}
