import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import type { createComponentModel } from './FaqEditor.model';
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
            onChange={$textProperty(() => item, 'question')}
          />
          <p className="counter">
            {item.question.length}
            {' / 300'}
          </p>
          <label htmlFor={`faq-answer-${index}`}>{'Ответ'}</label>
          <textarea
            id={`faq-answer-${index}`}
            maxLength={3000}
            required
            rows={4}
            value={item.answer ?? ''}
            onChange={$textProperty(() => item, 'answer')}
          />
          <p className="counter">
            {item.answer.length}
            {' / 3000'}
          </p>
          <div className="item-actions">
            <button
              type="button"
              onClick={() =>
                void $required($state.draft.value).faq.splice(index, 1)
              }
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
