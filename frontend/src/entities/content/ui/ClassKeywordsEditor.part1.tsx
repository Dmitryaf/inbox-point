import { renderList as $renderList } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import type { createComponentModel } from './ClassKeywordsEditor.model';
export function renderClassKeywordsEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { change } = $state;
  const targets = $state.targets.value;
  const draft = $state.draft.value;

  return (
    <>
      {$renderList(draft.keywords, (keyword, index) => (
        <div key={index} className="class-card" data-r-7964e07c="">
          <label htmlFor={`keyword-${index}`} data-r-7964e07c="">
            {'Слово или фраза '}
            {index + 1}
          </label>
          <input
            id={`keyword-${index}`}
            maxLength={80}
            placeholder="Например, Бачата"
            value={keyword.phrase ?? ''}
            onChange={$textProperty(() => keyword, 'phrase')}
            data-r-7964e07c=""
          />
          <label htmlFor={`keyword-target-${index}`} data-r-7964e07c="">
            {'Что открыть'}
          </label>
          <select
            id={`keyword-target-${index}`}
            value={`${keyword.targetType}:${keyword.targetId}`}
            onChange={$nativeHandler(($event) => void change(index, $event))}
            data-r-7964e07c=""
          >
            {$renderList(targets, (target) => (
              <option
                key={target.value}
                value={target.value}
                data-r-7964e07c=""
              >
                {target.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              void $required($state.draft.value).keywords.splice(index, 1)
            }
            className="danger"
            data-r-7964e07c=""
          >
            {' Удалить ключевое слово '}
          </button>
        </div>
      ))}
    </>
  );
}
