import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { invokeHandler as $invoke } from '@frontend/shared/lib/component-events';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './BackupCard.model';

export default function BackupCard($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { create } = $state;
  const pending = $state.pending.value;
  const message = $state.message.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="backup-title"
        className={$class('setup-card card', $attributes.className)}
      >
        <p className="step">{'Данные'}</p>
        <h2 id="backup-title">{'Резервная копия'}</h2>
        <p className="setup-lead">
          {
            ' Сохраните обращения и очередь доставки перед обновлением или переносом сервиса. '
          }
        </p>
        <button
          disabled={pending}
          type="button"
          onClick={($event) => {
            $invoke(create, $event);
          }}
        >
          {pending ? 'Создаём…' : 'Создать резервную копию'}
        </button>
        <p role="status" className="setup-note">
          {message}
        </p>
      </section>
    </ModelScopeProvider>
  );
}
