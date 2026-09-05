import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import ChannelStatusCard from './ChannelStatusCard';
import DeliveryStatusCard from './DeliveryStatusCard';

import { renderOperationsOverviewPart1 } from './OperationsOverview.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperationsOverview.model';

export default function OperationsOverview($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="overview-title"
        className={$class('overview', $attributes.className)}
      >
        {renderOperationsOverviewPart1($state, $props)}
        <div className="status-grid">
          <ChannelStatusCard
            name="Telegram"
            channel={$props.status.channels.telegram}
          />
          <ChannelStatusCard name="VK" channel={$props.status.channels.vk} />
          <DeliveryStatusCard deliveries={$props.status.deliveries} />
        </div>
      </section>
    </ModelScopeProvider>
  );
}
