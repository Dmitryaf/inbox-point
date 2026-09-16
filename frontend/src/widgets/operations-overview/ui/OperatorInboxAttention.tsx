import '@frontend/widgets/operations-overview/styles/operator-inbox-attention.react-data-r-21a2123f.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperatorInboxAttention.model';

export default function OperatorInboxAttention($incomingProps: ComponentProps) {
  const { props: $props, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <article
        {...$attributes}
        className={$class('operator-inbox-attention', $attributes.className)}
        data-r-21a2123f=""
      >
        <h3 data-r-21a2123f="">{'Обращения ждут доставки в Telegram'}</h3>
        <p data-r-21a2123f="">
          {' Сохранено обращений: '}
          {$props.activeRequests}
          {'. Система повторит доставку автоматически. '}
        </p>
        <p data-r-21a2123f="">{'Пока проверьте входящие обращения ниже.'}</p>
      </article>
    </ModelScopeProvider>
  );
}
