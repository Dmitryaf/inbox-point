import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import FieldError from '@frontend/shared/ui/FieldError';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './CustomSectionsEditor.model';
export function renderCustomSectionsEditorPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { move } = $state;
  const sections = $state.sections.value;

  return (
    <>
      {$renderList(sections, (section, index) => (
        <fieldset key={index} className="item-card" data-r-c3e93385="">
          <legend data-r-c3e93385="">
            {'Раздел '}
            {index + 1}
          </legend>
          <label htmlFor={`section-label-${index}`} data-r-c3e93385="">
            {'Название кнопки'}
          </label>
          <input
            id={`section-label-${index}`}
            aria-describedby={
              $props.errors[`section-label-${index}`]
                ? `section-label-${index}-error`
                : undefined
            }
            aria-invalid={Boolean($props.errors[`section-label-${index}`])}
            maxLength={40}
            required
            value={section.label ?? ''}
            onChange={$textProperty(() => section, 'label')}
            data-r-c3e93385=""
          />
          <FieldError
            id={`section-label-${index}-error`}
            text={$props.errors[`section-label-${index}`]}
            data-r-c3e93385=""
          />
          <p className="counter" data-r-c3e93385="">
            {section.label.length}
            {' / 40'}
          </p>
          <label htmlFor={`section-text-${index}`} data-r-c3e93385="">
            {'Текст ответа'}
          </label>
          <textarea
            id={`section-text-${index}`}
            aria-describedby={
              $props.errors[`section-text-${index}`]
                ? `section-text-${index}-error`
                : undefined
            }
            aria-invalid={Boolean($props.errors[`section-text-${index}`])}
            maxLength={4000}
            required
            rows={4}
            value={section.text ?? ''}
            onChange={$textProperty(() => section, 'text')}
            data-r-c3e93385=""
          />
          <FieldError
            id={`section-text-${index}-error`}
            text={$props.errors[`section-text-${index}`]}
            data-r-c3e93385=""
          />
          <p className="counter" data-r-c3e93385="">
            {section.text.length}
            {' / 4000'}
          </p>
          <div className="item-actions" data-r-c3e93385="">
            <button
              type="button"
              disabled={index === 0}
              aria-label={`Переместить раздел ${index + 1} выше`}
              onClick={() => void move(index, -1)}
              className="quiet"
              data-r-c3e93385=""
            >
              {' Выше '}
            </button>
            <button
              type="button"
              disabled={index === sections.length - 1}
              aria-label={`Переместить раздел ${index + 1} ниже`}
              onClick={() => void move(index, 1)}
              className="quiet"
              data-r-c3e93385=""
            >
              {' Ниже '}
            </button>
            <button
              type="button"
              onClick={() =>
                void $required($state.sections.value).splice(index, 1)
              }
              className="danger"
              data-r-c3e93385=""
            >
              {' Удалить раздел '}
            </button>
          </div>
        </fieldset>
      ))}
    </>
  );
}
