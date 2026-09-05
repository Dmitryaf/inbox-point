import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import {
  requiredValue as $required,
  setProperty as $setProperty,
} from '@frontend/shared/lib/component-bindings';

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
            onChange={$controlledChange<HTMLTextAreaElement>(($event) => {
              $setProperty(
                $required(item),
                'answer',
                $event.currentTarget.value,
              );
            })}
          />
          <p className="counter">
            {item.answer.length}
            {' / 3000'}
          </p>
          <div className="item-actions">
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
