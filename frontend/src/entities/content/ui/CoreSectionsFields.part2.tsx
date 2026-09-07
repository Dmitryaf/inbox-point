import { classNames as $class } from '@frontend/shared/lib/component-view';

import { propertySetter as $propertySetter } from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import FieldError from '@frontend/shared/ui/FieldError';
import SectionVisibilityControl from '@frontend/entities/content/ui/SectionVisibilityControl';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './CoreSectionsFields.model';
export function renderCoreSectionsFieldsPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const draft = $state.draft.value;
  const responseLengths = $state.responseLengths.value;

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
        <label htmlFor="prices">{'Текст ответа'}</label>
        <textarea
          id="prices"
          aria-describedby={$props.errors.prices ? 'prices-error' : undefined}
          aria-invalid={Boolean($props.errors.prices)}
          maxLength={4000}
          rows={5}
          value={draft.prices ?? ''}
          onChange={$textProperty(() => $state.draft.value, 'prices')}
        />
        <FieldError id="prices-error" text={$props.errors.prices} />
        <p
          className={$class('counter', {
            'counter--error': responseLengths.prices > 4000,
          })}
        >
          {' Итоговый ответ: '}
          {responseLengths.prices}
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
