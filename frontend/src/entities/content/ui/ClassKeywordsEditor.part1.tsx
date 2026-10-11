import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ClassKeywordsEditor.model';
export function renderClassKeywordsEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { moveToGroup, remove } = $state;
  const directionWords = $state.directionWords.value;

  return (
    <>
      {$renderList(directionWords, (word, index) => (
        <div key={index} className="class-word" data-r-7964e07c="">
          <label
            htmlFor={'direction-word-' + $props.targetId + '-' + index}
            data-r-7964e07c=""
          >
            {' Сохранённое слово для всего направления '}
          </label>
          <input
            id={'direction-word-' + $props.targetId + '-' + index}
            value={word.phrase}
            readOnly
            data-r-7964e07c=""
          />
          <div className="class-actions" data-r-7964e07c="">
            <button
              type="button"
              onClick={() => void moveToGroup(word)}
              className="secondary-button"
              data-r-7964e07c=""
            >
              {' Использовать «'}
              {word.phrase}
              {'» для этой группы '}
            </button>
            <button
              type="button"
              onClick={() => void remove(word)}
              className="danger"
              data-r-7964e07c=""
            >
              {' Удалить слово '}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
