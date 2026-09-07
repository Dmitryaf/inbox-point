import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderDeliveryStatusCardPart1 } from './DeliveryStatusCard.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './DeliveryStatusCard.model';

export default function DeliveryStatusCard($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { refresh } = $state;
  const message = $state.message.value;
  const summary = $state.summary.value;
  const loading = $state.loading.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="delivery-title"
        className={$class('setup-card card', $attributes.className)}
      >
        <p className="step">{'Контроль'}</p>
        <h2 id="delivery-title">{'Доставка ответов'}</h2>
        <p role="status" className="setup-lead">
          {$or(message, () => summary)}
        </p>
        {renderDeliveryStatusCardPart1($state)}
        <button
          disabled={loading}
          onClick={$nativeHandler(refresh)}
          className="secondary-button"
        >
          {loading ? 'Обновляем…' : 'Обновить'}
        </button>
        <p className="setup-note">
          {' Тексты сообщений и имена отправителей здесь не отображаются. '}
        </p>
      </section>
    </ModelScopeProvider>
  );
}
