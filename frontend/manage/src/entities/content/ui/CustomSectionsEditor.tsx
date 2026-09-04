import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import {
  classNames as $class,
  renderList as $renderList,
} from '@manage/shared/lib/component-view';
import { invokeHandler as $invoke } from '@manage/shared/lib/component-events';

import {
  requiredValue as $required,
  setProperty as $setProperty,
} from '@manage/shared/lib/component-bindings';
import { inheritedAttributes } from '@manage/shared/lib/component-attributes';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './CustomSectionsEditor.model';
import { controlledChange as $controlledChange } from '@manage/shared/lib/component-input-event';

export default function CustomSectionsEditor($incomingProps: ComponentProps) {
  const $attributes = inheritedAttributes($incomingProps);
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { add } = $state;

  const sections = $state.sections.value;
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        className={$class('card', $attributes.className)}
      >
        <div className="section-heading">
          <div>
            <p className="step">{'Свои кнопки'}</p>
            <h2>{'Дополнительные разделы'}</h2>
          </div>
          <span>
            {sections.length}
            {' / 6'}
          </span>
        </div>
        {sections.length === 0 ? (
          <p className="empty">{' Дополнительных разделов пока нет. '}</p>
        ) : null}
        {$renderList(sections, (section, index) => (
          <fieldset key={index} className="item-card">
            <legend>
              {'Раздел '}
              {index + 1}
            </legend>
            <label htmlFor={`section-label-${index}`}>
              {'Название кнопки'}
            </label>
            <input
              id={`section-label-${index}`}
              maxLength={40}
              required
              value={section.label ?? ''}
              onChange={$controlledChange<HTMLInputElement>(($event) => {
                $setProperty(
                  $required(section),
                  'label',
                  $event.currentTarget.value,
                );
              })}
            />
            <label htmlFor={`section-text-${index}`}>
              {'Текст для клиента'}
            </label>
            <textarea
              id={`section-text-${index}`}
              maxLength={4000}
              required
              rows={4}
              value={section.text ?? ''}
              onChange={$controlledChange<HTMLTextAreaElement>(($event) => {
                $setProperty(
                  $required(section),
                  'text',
                  $event.currentTarget.value,
                );
              })}
            />
            <div className="item-actions">
              <button
                type="button"
                onClick={() => {
                  void $required($state.sections.value).splice(index, 1);
                }}
                className="danger"
              >
                {' Удалить раздел '}
              </button>
            </div>
          </fieldset>
        ))}
        <button
          disabled={sections.length >= 6}
          type="button"
          onClick={($event) => {
            $invoke(add, $event);
          }}
        >
          {' Добавить раздел '}
        </button>
      </section>
    </ModelScopeProvider>
  );
}
