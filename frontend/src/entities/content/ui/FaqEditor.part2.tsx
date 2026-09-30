import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import FieldError from '@frontend/shared/ui/FieldError';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './FaqEditor.model';
export function renderFaqEditorPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const itemKey = $unref($state.itemKey);
  const draft = $state.draft.value;

  return (
    <>
      {$renderList(draft.faq, (item, index) => (
        <fieldset key={itemKey(item)} className="item-card" data-r-0b16243c="">
          <legend data-r-0b16243c="">
            {'Вопрос '}
            {index + 1}
          </legend>
          <label htmlFor={`faq-question-${index}`} data-r-0b16243c="">
            {'Вопрос'}
          </label>
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
            data-r-0b16243c=""
          />
          <FieldError
            id={`faq-question-${index}-error`}
            text={$props.errors[`faq-question-${index}`]}
            data-r-0b16243c=""
          />
          <p className="counter" data-r-0b16243c="">
            {item.question.length}
            {' / 300'}
          </p>
          <label htmlFor={`faq-answer-${index}`} data-r-0b16243c="">
            {'Ответ'}
          </label>
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
            data-r-0b16243c=""
          />
          <FieldError
            id={`faq-answer-${index}-error`}
            text={$props.errors[`faq-answer-${index}`]}
            data-r-0b16243c=""
          />
          <p className="counter" data-r-0b16243c="">
            {item.answer.length}
            {' / 3000'}
          </p>
          <div className="item-actions" data-r-0b16243c="">
            <button
              type="button"
              disabled={index === 0}
              aria-label={`Переместить вопрос ${index + 1} выше`}
              data-move="-1"
              onClick={() => void $unref($state.move)(index, -1)}
              className="quiet"
              data-r-0b16243c=""
            >
              {' Выше '}
            </button>
            <button
              type="button"
              disabled={index === draft.faq.length - 1}
              aria-label={`Переместить вопрос ${index + 1} ниже`}
              data-move="1"
              onClick={() => void $unref($state.move)(index, 1)}
              className="quiet"
              data-r-0b16243c=""
            >
              {' Ниже '}
            </button>
            <button
              type="button"
              onClick={() => void $unref($state.remove)(index)}
              className="danger"
              data-r-0b16243c=""
            >
              {' Удалить '}
            </button>
          </div>
        </fieldset>
      ))}
    </>
  );
}
