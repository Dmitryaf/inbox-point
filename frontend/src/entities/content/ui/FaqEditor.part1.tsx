import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import FieldError from '@frontend/shared/ui/FieldError';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './FaqEditor.model';
export function renderFaqEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
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
            aria-describedby={
              $props.errors[`faq-question-${index}`]
                ? `faq-question-${index}-error`
                : undefined
            }
            aria-invalid={Boolean($props.errors[`faq-question-${index}`])}
            maxLength={300}
            required
            value={item.question ?? ''}
            onChange={$textProperty(() => item, 'question')}
          />
          <FieldError
            id={`faq-question-${index}-error`}
            text={$props.errors[`faq-question-${index}`]}
          />
          <p className="counter">
            {item.question.length}
            {' / 300'}
          </p>
          <label htmlFor={`faq-answer-${index}`}>{'Ответ'}</label>
          <textarea
            id={`faq-answer-${index}`}
            aria-describedby={
              $props.errors[`faq-answer-${index}`]
                ? `faq-answer-${index}-error`
                : undefined
            }
            aria-invalid={Boolean($props.errors[`faq-answer-${index}`])}
            maxLength={3000}
            required
            rows={4}
            value={item.answer ?? ''}
            onChange={$textProperty(() => item, 'answer')}
          />
          <FieldError
            id={`faq-answer-${index}-error`}
            text={$props.errors[`faq-answer-${index}`]}
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
