import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import type { createComponentModel } from './CustomSectionsEditor.model';
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
            onChange={$textProperty(() => section, 'label')}
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
            onChange={$textProperty(() => section, 'text')}
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
