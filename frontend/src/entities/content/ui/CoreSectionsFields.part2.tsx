import { classNames as $class } from '@frontend/shared/lib/component-view';

import { propertySetter as $propertySetter } from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import SectionVisibilityControl from '@frontend/entities/content/ui/SectionVisibilityControl';

import type { createComponentModel } from './CoreSectionsFields.model';
export function renderCoreSectionsFieldsPart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const draft = $state.draft.value;
  const pricesLength = $state.pricesLength.value;

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
          onChange={$textProperty(() => $state.draft.value, 'prices')}
        />
        <p
          className={$class('counter', {
            'counter--error': pricesLength > 4000,
          })}
        >
          {' Итоговый ответ: '}
          {pricesLength}
          {' / 4000 '}
        </p>
        <SectionVisibilityControl
          contentPresent={Boolean(draft.prices.trim())}
          section="prices"
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
