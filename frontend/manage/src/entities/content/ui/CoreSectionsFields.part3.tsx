import {
  requiredValue as $required,
  setProperty as $setProperty,
} from '@manage/shared/lib/component-bindings';

import type { createComponentModel } from './CoreSectionsFields.model';
import { controlledChange as $controlledChange } from '@manage/shared/lib/component-input-event';
export function renderCoreSectionsFieldsPart3(
  $state: ReturnType<typeof createComponentModel>,
) {
  const draft = $state.draft.value;
  return (
    <>
      <details className="field-group">
        <summary>
          <strong>{'Адрес'}</strong>
          <small>{draft.address.trim() ? 'Заполнено' : 'Не заполнено'}</small>
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
      </details>
    </>
  );
}
