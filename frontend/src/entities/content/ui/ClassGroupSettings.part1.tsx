import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ClassGroupSettings.model';
export function renderClassGroupSettingsPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const group = $state.group.value;

  return (
    <>
      {!group.review ? (
        <select
          id={'group-direction-' + group.id}
          value={group.directionId ?? ''}
          onChange={$textProperty(() => $state.group.value, 'directionId')}
          data-r-e1399ad4=""
        >
          {$renderList($props.directions, (item) => (
            <option key={item.id} value={item.id} data-r-e1399ad4="">
              {item.name}
            </option>
          ))}
        </select>
      ) : null}
    </>
  );
}
