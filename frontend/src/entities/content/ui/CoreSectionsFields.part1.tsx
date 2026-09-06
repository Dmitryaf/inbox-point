import { classNames as $class } from '@frontend/shared/lib/component-view';

import { propertySetter as $propertySetter } from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import SectionVisibilityControl from '@frontend/entities/content/ui/SectionVisibilityControl';

import type { createComponentModel } from './CoreSectionsFields.model';
export function renderCoreSectionsFieldsPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const draft = $state.draft.value;
  const scheduleLength = $state.scheduleLength.value;

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
        <label htmlFor="schedule">{'Текст для клиента'}</label>
        <textarea
          id="schedule"
          maxLength={4000}
          rows={5}
          value={draft.schedule ?? ''}
          onChange={$textProperty(() => $state.draft.value, 'schedule')}
        />
        <p
          className={$class('counter', {
            'counter--error': scheduleLength > 4000,
          })}
        >
          {' Итоговый ответ: '}
          {scheduleLength}
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
