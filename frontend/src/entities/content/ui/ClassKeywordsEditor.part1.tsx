import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { createComponentModel } from './ClassKeywordsEditor.model';
export function renderClassKeywordsEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { moveToGroup, remove } = $state;
  const directionWords = $state.directionWords.value;

  return (
    <>
      {$renderList(directionWords, (word) => (
        <div key={word.phrase} className="class-word" data-r-7964e07c="">
          <p data-r-7964e07c="">
            {'Слово «'}
            {word.phrase}
            {'» пока открывает всё направление.'}
          </p>
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
      ))}
    </>
  );
}
