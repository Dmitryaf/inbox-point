import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { textModel as $textModel } from '@frontend/shared/lib/component-inputs';

import type { createComponentModel } from './ClassScheduleEditor.model';
export function renderClassScheduleEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { add } = $state;
  const draft = $state.draft.value;
  const directionName = $state.directionName.value;

  return (
    <>
      <div className="class-actions" data-r-13661f32="">
        <input
          id="new-direction-name"
          maxLength={80}
          placeholder="Например, Бачата"
          onKeyDown={$nativeHandler(add, { prevent: true, key: 'Enter' })}
          value={directionName ?? ''}
          onChange={$textModel($state, 'directionName')}
          data-r-13661f32=""
        />
        <button
          type="button"
          disabled={draft.directions.length >= 20}
          onClick={$nativeHandler(add)}
          data-r-13661f32=""
        >
          {' Добавить направление '}
        </button>
      </div>
    </>
  );
}
