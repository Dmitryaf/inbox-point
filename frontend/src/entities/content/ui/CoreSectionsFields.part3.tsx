import { classNames as $class } from '@frontend/shared/lib/component-view';

import { propertySetter as $propertySetter } from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import SectionVisibilityControl from '@frontend/entities/content/ui/SectionVisibilityControl';

import type { createComponentModel } from './CoreSectionsFields.model';
export function renderCoreSectionsFieldsPart3(
  $state: ReturnType<typeof createComponentModel>,
) {
  const draft = $state.draft.value;
  const addressLength = $state.addressLength.value;

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
          onChange={$textProperty(() => $state.draft.value, 'address')}
        />
        <p
          className={$class('counter', {
            'counter--error': addressLength > 4000,
          })}
        >
          {' Итоговый ответ: '}
          {addressLength}
          {' / 4000 '}
        </p>
        <SectionVisibilityControl
          contentPresent={Boolean(draft.address.trim())}
          section="address"
          modelValue={draft.visibleSections}
          onModelValueChange={$propertySetter(
            () => $state.draft.value,
            'visibleSections',
          )}
        />
      </details>
    </>
  );
}
