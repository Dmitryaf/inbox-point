import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import {
  requiredValue as $required,
  setProperty as $setProperty,
} from '@frontend/shared/lib/component-bindings';

import type { createComponentModel } from './CustomSectionsEditor.model';
import { controlledChange as $controlledChange } from '@frontend/shared/lib/component-input-event';
export function renderCustomSectionsEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
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
          <p className="counter">
            {section.label.length}
            {' / 40'}
          </p>
          <label htmlFor={`section-text-${index}`}>{'Текст для клиента'}</label>
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
          <p className="counter">
            {section.text.length}
            {' / 4000'}
          </p>
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
    </>
  );
}
