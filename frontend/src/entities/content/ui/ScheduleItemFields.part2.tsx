import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ScheduleItemFields.model';
export function renderScheduleItemFieldsPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const item = $state.item.value;

  return (
    <>
      <input
        id={`schedule-day-time-${$props.index}`}
        aria-describedby={
          $props.errors[`schedule-day-time-${$props.index}`]
            ? `schedule-day-time-${$props.index}-error`
            : undefined
        }
        aria-invalid={Boolean(
          $props.errors[`schedule-day-time-${$props.index}`],
        )}
        maxLength={120}
        placeholder="Вт / Чт, 19:00"
        required
        value={item.dayTime ?? ''}
        onChange={$textProperty(() => $state.item.value, 'dayTime')}
        data-r-f3bf3992=""
      />
    </>
  );
}
