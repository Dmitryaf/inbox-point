import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  requiredValue as $required,
  setProperty as $setProperty,
} from '@frontend/shared/lib/component-bindings';

import { moveItem } from '@frontend/shared/lib/move-item';

import type { createComponentModel } from './FaqEditor.model';
import { controlledChange as $controlledChange } from '@frontend/shared/lib/component-input-event';
export function renderFaqEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const draft = $state.draft.value;
  return (
    <>
      {$renderList(draft.faq, (item, index) => (
        <fieldset key={index} className="item-card">
          <legend>
            {'Вопрос '}
            {index + 1}
          </legend>
          <label htmlFor={`faq-question-${index}`}>{'Вопрос'}</label>
          <input
            id={`faq-question-${index}`}
            maxLength={300}
            required
            value={item.question ?? ''}
            onChange={$controlledChange<HTMLInputElement>(($event) => {
              $setProperty(
                $required(item),
                'question',
                $event.currentTarget.value,
              );
            })}
          />
          <label htmlFor={`faq-answer-${index}`}>{'Ответ'}</label>
          <textarea
            id={`faq-answer-${index}`}
            maxLength={3000}
            required
            rows={4}
            value={item.answer ?? ''}
            onChange={$controlledChange<HTMLTextAreaElement>(($event) => {
              $setProperty(
                $required(item),
                'answer',
                $event.currentTarget.value,
              );
            })}
          />
          <div className="item-actions">
            <button
              disabled={index === 0}
              type="button"
              onClick={() => {
                void $unref(moveItem)(
                  $required($state.draft.value).faq,
                  index,
                  -1,
                );
              }}
            >
              {' Выше '}
            </button>
            <button
              disabled={index === draft.faq.length - 1}
              type="button"
              onClick={() => {
                void $unref(moveItem)(
                  $required($state.draft.value).faq,
                  index,
                  1,
                );
              }}
            >
              {' Ниже '}
            </button>
            <button
              type="button"
              onClick={() => {
                void $required($state.draft.value).faq.splice(index, 1);
              }}
              className="danger"
            >
              {' Удалить '}
            </button>
          </div>
        </fieldset>
      ))}
    </>
  );
}
