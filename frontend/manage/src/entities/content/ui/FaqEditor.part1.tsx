import { renderList as $renderList } from '@manage/shared/lib/component-view';

import { unref as $unref } from '@manage/shared/lib/model-state';
import {
  requiredValue as $required,
  setProperty as $setProperty,
} from '@manage/shared/lib/component-bindings';

import { moveItem } from '@manage/shared/lib/move-item';

import type { createComponentModel } from './FaqEditor.model';
import { controlledChange as $controlledChange } from '@manage/shared/lib/component-input-event';
export function renderFaqEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const items = $state.items.value;
  return (
    <>
      {$renderList(items, (item, index) => (
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
                void $unref(moveItem)($state.items.value, index, -1);
              }}
            >
              {' Выше '}
            </button>
            <button
              disabled={index === items.length - 1}
              type="button"
              onClick={() => {
                void $unref(moveItem)($state.items.value, index, 1);
              }}
            >
              {' Ниже '}
            </button>
            <button
              type="button"
              onClick={() => {
                void $required($state.items.value).splice(index, 1);
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
