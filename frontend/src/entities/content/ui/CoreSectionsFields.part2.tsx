import {
  requiredValue as $required,
  setProperty as $setProperty,
} from '@frontend/shared/lib/component-bindings';

import SectionVisibilityControl from '@frontend/entities/content/ui/SectionVisibilityControl';

import type { createComponentModel } from './CoreSectionsFields.model';
import { controlledChange as $controlledChange } from '@frontend/shared/lib/component-input-event';
export function renderCoreSectionsFieldsPart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const draft = $state.draft.value;
  return (
    <>
      <details className="field-group">
        <summary>
          <span className="summary-copy">
            <strong>{'Цены'}</strong>
            <span className="summary-action summary-action--open">
              {' Открыть настройки раздела '}
            </span>
            <span className="summary-action summary-action--close">
              {' Скрыть настройки раздела '}
            </span>
          </span>
          <span className="summary-meta">
            <small>{draft.prices.trim() ? 'Заполнено' : 'Не заполнено'}</small>
            <span aria-hidden="true" className="disclosure-chevron" />
          </span>
        </summary>
        <label htmlFor="prices">{'Текст для клиента'}</label>
        <textarea
          id="prices"
          maxLength={4000}
          rows={5}
          value={draft.prices ?? ''}
          onChange={$controlledChange<HTMLTextAreaElement>(($event) => {
            $setProperty(
              $required($state.draft.value),
              'prices',
              $event.currentTarget.value,
            );
          })}
        />
        <p className="counter">
          {draft.prices.length}
          {' / 4000'}
        </p>
        <SectionVisibilityControl
          contentPresent={Boolean(draft.prices.trim())}
          section="prices"
          modelValue={draft.visibleSections}
          onModelValueChange={($value) => {
            $setProperty(
              $required($state.draft.value),
              'visibleSections',
              $value,
            );
          }}
        />
      </details>
    </>
  );
}
