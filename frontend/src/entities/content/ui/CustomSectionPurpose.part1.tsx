import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { setModelValue as $set } from '@frontend/shared/lib/component-bindings';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './CustomSectionPurpose.model';
import { controlledChange as $controlledChange } from '@frontend/shared/lib/component-input-event';
export function renderCustomSectionPurposePart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const purposes = $unref($state.purposes);
  const mode = $state.mode.value;

  return (
    <>
      {$renderList(purposes, (purpose) => (
        <label
          key={purpose.value}
          className="purpose-option"
          data-r-fc41a8d8=""
        >
          <input
            type="radio"
            name={$props.name}
            value={purpose.value}
            checked={(mode ?? 'information') === purpose.value}
            onChange={$controlledChange<HTMLInputElement>(
              () => void $set($state, 'mode', purpose.value),
            )}
            data-r-fc41a8d8=""
          />
          <span data-r-fc41a8d8="">
            <strong data-r-fc41a8d8="">{purpose.label}</strong>
            <span data-r-fc41a8d8="">{purpose.description}</span>
          </span>
        </label>
      ))}
    </>
  );
}
