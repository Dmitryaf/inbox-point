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
export function renderCustomSectionsEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const sections = $state.sections.value;

  return (
    <>
      {$renderList(sections, (section, index) => (
        <fieldset key={index} className="item-card">
          <legend>
            {'Раздел '}
            {index + 1}
          </legend>
          <label htmlFor={`section-label-${index}`}>{'Название кнопки'}</label>
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
          />
          <FieldError
            id={`section-label-${index}-error`}
            text={$props.errors[`section-label-${index}`]}
          />
          <p className="counter">
            {section.label.length}
            {' / 40'}
          </p>
          <label htmlFor={`section-text-${index}`}>{'Текст ответа'}</label>
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
          />
          <FieldError
            id={`section-text-${index}-error`}
            text={$props.errors[`section-text-${index}`]}
          />
          <p className="counter">
            {section.text.length}
            {' / 4000'}
          </p>
          <div className="item-actions">
            <button
              type="button"
              onClick={() =>
                void $required($state.sections.value).splice(index, 1)
              }
              className="danger"
            >
              {' Удалить раздел '}
            </button>
          </div>
        </fieldset>
      ))}
    </>
  );
}
