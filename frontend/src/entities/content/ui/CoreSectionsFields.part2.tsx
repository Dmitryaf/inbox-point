import {
  requiredValue as $required,
  setProperty as $setProperty,
} from '@frontend/shared/lib/component-bindings';

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
          <strong>{'Цены'}</strong>
          <small>{draft.prices.trim() ? 'Заполнено' : 'Не заполнено'}</small>
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
      </details>
    </>
  );
}
