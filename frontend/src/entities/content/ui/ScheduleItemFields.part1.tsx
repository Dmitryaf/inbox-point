import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ScheduleItemFields.model';
export function renderScheduleItemFieldsPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const item = $state.item.value;

  return (
    <>
      <input
        id={`schedule-title-${$props.index}`}
        aria-describedby={
          $props.errors[`schedule-title-${$props.index}`]
            ? `schedule-title-${$props.index}-error`
            : undefined
        }
        aria-invalid={Boolean($props.errors[`schedule-title-${$props.index}`])}
        maxLength={120}
        required
        value={item.title ?? ''}
        onChange={$textProperty(() => $state.item.value, 'title')}
        data-r-f3bf3992=""
      />
    </>
  );
}
