import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';

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
        <label htmlFor="schedule">{'Расписание'}</label>
        <textarea
          id="schedule"
          maxLength={4000}
          rows={5}
          value={draft.schedule ?? ''}
          onChange={$controlledChange<HTMLTextAreaElement>(($event) => {
            $state.draft.value.schedule = $event.currentTarget.value;
          })}
        />
        <p className="counter">
          {draft.schedule.length}
          {' / 4000'}
        </p>
        <label htmlFor="prices">{'Цены'}</label>
        <textarea
          id="prices"
          maxLength={4000}
          rows={5}
          value={draft.prices ?? ''}
          onChange={$controlledChange<HTMLTextAreaElement>(($event) => {
            $state.draft.value.prices = $event.currentTarget.value;
          })}
        />
        <p className="counter">
          {draft.prices.length}
          {' / 4000'}
        </p>
        <label htmlFor="address">{'Адрес'}</label>
        <textarea
          id="address"
          maxLength={4000}
          rows={4}
          value={draft.address ?? ''}
          onChange={$controlledChange<HTMLTextAreaElement>(($event) => {
            $state.draft.value.address = $event.currentTarget.value;
          })}
        />
        <p className="counter">
          {draft.address.length}
          {' / 4000'}
        </p>
      </section>
    </ModelScopeProvider>
  );
}
