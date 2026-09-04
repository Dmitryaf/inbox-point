import {
  requiredValue as $required,
  setProperty as $setProperty,
} from '@manage/shared/lib/component-bindings';

import type { createComponentModel } from './CoreSectionsFields.model';
import { controlledChange as $controlledChange } from '@manage/shared/lib/component-input-event';
export function renderCoreSectionsFieldsPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const draft = $state.draft.value;
  return (
    <>
      <details open className="field-group">
        <summary>
          <strong>{'Расписание'}</strong>
          <small>{draft.schedule.trim() ? 'Заполнено' : 'Не заполнено'}</small>
        </summary>
        <label htmlFor="schedule">{'Текст для клиента'}</label>
        <textarea
          id="schedule"
          maxLength={4000}
          rows={5}
          value={draft.schedule ?? ''}
          onChange={$controlledChange<HTMLTextAreaElement>(($event) => {
            $setProperty(
              $required($state.draft.value),
              'schedule',
              $event.currentTarget.value,
            );
          })}
        />
        <p className="counter">
          {draft.schedule.length}
          {' / 4000'}
        </p>
      </details>
    </>
  );
}
