import { eventCallback as $callback } from '@frontend/shared/lib/component-events';

import {
  setModelValue as $set,
  modelSetter as $setter,
} from '@frontend/shared/lib/component-bindings';

import ClassDirectionEditor from './ClassDirectionEditor';
import ClassGroupEditor from './ClassGroupEditor';
import ClassDirectionList from './ClassDirectionList';

import type { createComponentModel } from './ClassScheduleEditor.model';
export function renderClassScheduleEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { open } = $state;
  const group = $state.group.value;
  const direction = $state.direction.value;
  const reviewing = $state.reviewing.value;
  const draft = $state.draft.value;

  return (
    <>
      {group ? (
        <ClassGroupEditor
          key={group.id}
          groupId={group.id}
          onOpenTarget={$callback(open)}
          onRemoved={() => void $set($state, 'groupId', '')}
          modelValue={draft}
          onModelValueChange={$setter($state, 'draft')}
          data-r-13661f32=""
        />
      ) : direction ? (
        <ClassDirectionEditor
          key={direction.id}
          directionId={direction.id}
          onOpenTarget={$callback(open)}
          onRemoved={() => void $set($state, 'directionId', '')}
          modelValue={draft}
          onModelValueChange={$setter($state, 'draft')}
          data-r-13661f32=""
        />
      ) : (
        <ClassDirectionList
          onOpenTarget={$callback(open)}
          modelValue={draft}
          onModelValueChange={$setter($state, 'draft')}
          reviewing={reviewing}
          onReviewingChange={$setter($state, 'reviewing')}
          data-r-13661f32=""
        />
      )}
    </>
  );
}
