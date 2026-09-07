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
export function renderCoreSectionsFieldsPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const draft = $state.draft.value;
  const responseLengths = $state.responseLengths.value;

  return (
    <>
      <details open className="field-group">
        <summary>
          <span className="summary-copy">
            <strong>{'Расписание'}</strong>
            <span className="summary-action summary-action--open">
              {' Открыть настройки раздела '}
            </span>
            <span className="summary-action summary-action--close">
              {' Скрыть настройки раздела '}
            </span>
          </span>
          <span className="summary-meta">
            <small>
              {draft.schedule.trim() ? 'Заполнено' : 'Не заполнено'}
            </small>
            <span aria-hidden="true" className="disclosure-chevron" />
          </span>
        </summary>
        <label htmlFor="schedule">{'Текст ответа'}</label>
        <textarea
          id="schedule"
          aria-describedby={
            $props.errors.schedule ? 'schedule-error' : undefined
          }
          aria-invalid={Boolean($props.errors.schedule)}
          maxLength={4000}
          rows={5}
          value={draft.schedule ?? ''}
          onChange={$textProperty(() => $state.draft.value, 'schedule')}
        />
        <FieldError id="schedule-error" text={$props.errors.schedule} />
        <p
          className={$class('counter', {
            'counter--error': responseLengths.schedule > 4000,
          })}
        >
          {' Итоговый ответ: '}
          {responseLengths.schedule}
          {' / 4000 '}
        </p>
        <SectionVisibilityControl
          contentPresent={Boolean(draft.schedule.trim())}
          section="schedule"
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
