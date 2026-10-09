import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { propertySetter as $propertySetter } from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import CustomSectionPurpose from './CustomSectionPurpose';
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
  const itemKey = $unref($state.itemKey);
  const sections = $state.sections.value;

  return (
    <>
      {$renderList(sections, (section, index) => (
        <fieldset
          key={itemKey(section)}
          className="item-card"
          data-r-c3e93385=""
        >
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
          <CustomSectionPurpose
            name={`section-mode-${itemKey(section)}`}
            modelValue={section.mode}
            onModelValueChange={$propertySetter(() => section, 'mode')}
            data-r-c3e93385=""
          />
          <label htmlFor={`section-text-${index}`} data-r-c3e93385="">
            {section.mode === 'application'
              ? 'Что спросить у клиента?'
              : 'Текст ответа'}
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
            placeholder={
              section.mode === 'application'
                ? 'На какое занятие и в какой день хотите записаться?'
                : undefined
            }
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
              data-move="-1"
              onClick={() => void $unref($state.move)(index, -1)}
              className="quiet"
              data-r-c3e93385=""
            >
              {' Выше '}
            </button>
            <button
              type="button"
              disabled={index === sections.length - 1}
              aria-label={`Переместить раздел ${index + 1} ниже`}
              data-move="1"
              onClick={() => void $unref($state.move)(index, 1)}
              className="quiet"
              data-r-c3e93385=""
            >
              {' Ниже '}
            </button>
            <button
              type="button"
              onClick={() => void $unref($state.remove)(index)}
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
