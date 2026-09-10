import '@frontend/features/control-client-intake/styles/client-intake-control.react-data-r-77f00789.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import { renderClientIntakeControlPart1 } from './ClientIntakeControl.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClientIntakeControl.model';

export default function ClientIntakeControl($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const control = $unref($state.control);
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="intake-flow-title"
        className={$class('client-intake-control', $attributes.className)}
        data-r-77f00789=""
      >
        <p className="eyebrow" data-r-77f00789="">
          {'Клиент → оператор'}
        </p>
        <h3 id="intake-flow-title" data-r-77f00789="">
          {'Новые обращения'}
        </h3>
        <p className="intake-control-intro" data-r-77f00789="">
          {
            ' Пауза действует отдельно для Telegram и VK. Текущие обращения продолжат работать. '
          }
        </p>
        <AsyncMessage
          kind="error"
          text={control.actionError.value}
          data-r-77f00789=""
        />
        <AsyncMessage
          kind="success"
          text={control.notice.value}
          data-r-77f00789=""
        />
        {renderClientIntakeControlPart1($state)}
      </section>
    </ModelScopeProvider>
  );
}
