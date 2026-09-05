import {
  requiredValue as $required,
  setProperty as $setProperty,
} from '@frontend/shared/lib/component-bindings';

import SectionVisibilityControl from '@frontend/entities/content/ui/SectionVisibilityControl';

import type { createComponentModel } from './CoreSectionsFields.model';
import { controlledChange as $controlledChange } from '@frontend/shared/lib/component-input-event';
export function renderCoreSectionsFieldsPart3(
  $state: ReturnType<typeof createComponentModel>,
) {
  const draft = $state.draft.value;
  return (
    <>
      <details className="field-group">
        <summary>
          <span className="summary-copy">
            <strong>{'Адрес'}</strong>
            <span className="summary-action summary-action--open">
              {' Открыть настройки раздела '}
            </span>
            <span className="summary-action summary-action--close">
              {' Скрыть настройки раздела '}
            </span>
          </span>
          <span className="summary-meta">
            <small>{draft.address.trim() ? 'Заполнено' : 'Не заполнено'}</small>
            <span aria-hidden="true" className="disclosure-chevron" />
          </span>
        </summary>
        <label htmlFor="address">{'Текст для клиента'}</label>
        <textarea
          id="address"
          maxLength={4000}
          rows={4}
          value={draft.address ?? ''}
          onChange={$controlledChange<HTMLTextAreaElement>(($event) => {
            $setProperty(
              $required($state.draft.value),
              'address',
              $event.currentTarget.value,
            );
          })}
        />
        <p className="counter">
          {draft.address.length}
          {' / 4000'}
        </p>
        <SectionVisibilityControl
          contentPresent={Boolean(draft.address.trim())}
          section="address"
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
