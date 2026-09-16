import '@frontend/widgets/operations-overview/styles/incident-list.react-data-r-464ae559.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderOperatorRelayIncidentActionsPart1 } from './OperatorRelayIncidentActions.part1';
import { renderOperatorRelayIncidentActionsPart2 } from './OperatorRelayIncidentActions.part2';
import { renderOperatorRelayIncidentActionsPart3 } from './OperatorRelayIncidentActions.part3';
import { renderOperatorRelayIncidentActionsPart4 } from './OperatorRelayIncidentActions.part4';
import { renderOperatorRelayIncidentActionsPart5 } from './OperatorRelayIncidentActions.part5';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperatorRelayIncidentActions.model';

export default function OperatorRelayIncidentActions(
  $incomingProps: ComponentProps,
) {
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
      <div
        {...$attributes}
        className={$class('delivery-resolution-actions', $attributes.className)}
        data-r-464ae559=""
      >
        {$props.incident.action === 'relay_message' ? (
          <p data-r-464ae559="">
            {' Проверьте Telegram-тему перед выбором действия. '}
          </p>
        ) : null}
        {$props.incident.action === 'relay_message' &&
        !$props.incident.confirmable ? (
          <p data-r-464ae559="">
            {
              ' Не все сообщения появились в Telegram. Откройте обращение здесь. '
            }
          </p>
        ) : null}
        {renderOperatorRelayIncidentActionsPart1($state, $props)}
        {renderOperatorRelayIncidentActionsPart2($state, $props)}
        {renderOperatorRelayIncidentActionsPart3($state, $props)}
        {renderOperatorRelayIncidentActionsPart4($state, $props)}
        {renderOperatorRelayIncidentActionsPart5($state, $props)}
      </div>
    </ModelScopeProvider>
  );
}
