import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { renderList as $renderList } from '@manage/shared/lib/component-view';
import { invokeHandler as $invoke } from '@manage/shared/lib/component-events';
import { unref as $unref } from '@manage/shared/lib/model-state';
import { requiredValue as $required } from '@manage/shared/lib/component-bindings';

import { moveItem } from '@manage/shared/lib/move-item';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './FaqEditor.model';
import { controlledChange as $controlledChange } from '@manage/shared/lib/component-input-event';

export default function FaqEditor($incomingProps: ComponentProps) {
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { add } = $state;

  const items = $state.items.value;
  return (
    <ModelScopeProvider scope={$scope}>
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="step">{'Готовый раздел меню'}</p>
            <h2>{'Частые вопросы'}</h2>
          </div>
          <span>
            {items.length}
            {' / 20'}
          </span>
        </div>
        <p>{'Вопросы показываются клиенту в этом порядке.'}</p>
        {items.length === 0 ? (
          <p className="empty">
            {' Вопросов пока нет. Клиенту предложат написать преподавателю. '}
          </p>
        ) : null}
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
                item.question = $event.currentTarget.value;
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
                item.answer = $event.currentTarget.value;
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
        <button
          disabled={items.length >= 20}
          type="button"
          onClick={($event) => {
            $invoke(add, $event);
          }}
        >
          {' Добавить вопрос '}
        </button>
      </section>
    </ModelScopeProvider>
  );
}
