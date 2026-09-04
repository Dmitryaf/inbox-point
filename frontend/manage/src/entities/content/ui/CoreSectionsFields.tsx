import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';

import { requiredValue as $required } from '@manage/shared/lib/component-bindings';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './CoreSectionsFields.model';
import { controlledChange as $controlledChange } from '@manage/shared/lib/component-input-event';

export default function CoreSectionsFields($incomingProps: ComponentProps) {
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  const draft = $state.draft.value;
  return (
    <ModelScopeProvider scope={$scope}>
      <section className="card">
        <p className="step">{'Основные разделы'}</p>
        <h2>{'Расписание, цены и адрес'}</h2>
        <details open className="field-group">
          <summary>
            <strong>{'Расписание'}</strong>
            <small>
              {draft.schedule.trim() ? 'Заполнено' : 'Не заполнено'}
            </small>
          </summary>
          <label htmlFor="schedule">{'Текст для клиента'}</label>
          <textarea
            id="schedule"
            maxLength={4000}
            rows={5}
            value={draft.schedule ?? ''}
            onChange={$controlledChange<HTMLTextAreaElement>(($event) => {
              $required($state.draft.value).schedule =
                $event.currentTarget.value;
            })}
          />
          <p className="counter">
            {draft.schedule.length}
            {' / 4000'}
          </p>
        </details>
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
              $required($state.draft.value).prices = $event.currentTarget.value;
            })}
          />
          <p className="counter">
            {draft.prices.length}
            {' / 4000'}
          </p>
        </details>
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
              $required($state.draft.value).address =
                $event.currentTarget.value;
            })}
          />
          <p className="counter">
            {draft.address.length}
            {' / 4000'}
          </p>
        </details>
      </section>
    </ModelScopeProvider>
  );
}
