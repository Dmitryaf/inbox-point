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
      <details className="field-group" data-r-54db50dd="">
        <summary data-r-54db50dd="">
          <span className="summary-copy" data-r-54db50dd="">
            <strong data-r-54db50dd="">{'Адрес'}</strong>
          </span>
          <span className="summary-meta" data-r-54db50dd="">
            <small data-r-54db50dd="">
              {draft.address.trim() ? 'Заполнено' : 'Не заполнено'}
            </small>
            <span
              aria-hidden="true"
              className="disclosure-chevron"
              data-r-54db50dd=""
            />
          </span>
        </summary>
        <label htmlFor="address" data-r-54db50dd="">
          {'Текст ответа'}
        </label>
        <textarea
          id="address"
          aria-describedby={$props.errors.address ? 'address-error' : undefined}
          aria-invalid={Boolean($props.errors.address)}
          maxLength={4000}
          rows={4}
          value={draft.address ?? ''}
          onChange={$textProperty(() => $state.draft.value, 'address')}
          data-r-54db50dd=""
        />
        <FieldError
          id="address-error"
          text={$props.errors.address}
          data-r-54db50dd=""
        />
        <p
          className={$class('counter', {
            'counter--error': responseLengths.address > 4000,
          })}
          data-r-54db50dd=""
        >
          {' Итоговый ответ: '}
          {responseLengths.address}
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
          data-r-54db50dd=""
        />
      </details>
    </>
  );
}
