import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

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
  const { targetLabel, conflict, remove } = $state;
  const words = $state.words.value;

  return (
    <>
      {$renderList(words, (word, index) => (
        <div key={index} className="class-card" data-r-7964e07c="">
          <label
            htmlFor={'keyword-' + $props.targetId + '-' + index}
            data-r-7964e07c=""
          >
            {'Слово или фраза '}
            {index + 1}
          </label>
          <input
            id={'keyword-' + $props.targetId + '-' + index}
            maxLength={80}
            placeholder="Например, Бачата"
            value={word.phrase ?? ''}
            onChange={$textProperty(() => word, 'phrase')}
            data-r-7964e07c=""
          />
          {conflict(word) ? (
            <p role="alert" data-r-7964e07c="">
              {' Слово «'}
              {word.phrase}
              {'» уже открывает «'}
              {targetLabel(conflict(word)!)}
              {'». '}
              <button
                type="button"
                onClick={() =>
                  void $unref($state.emit)(
                    'openTarget',
                    conflict(word)!.targetType,
                    conflict(word)!.targetId,
                  )
                }
                className="secondary-button"
                data-r-7964e07c=""
              >
                {' Перейти к настройке '}
              </button>
            </p>
          ) : null}
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
