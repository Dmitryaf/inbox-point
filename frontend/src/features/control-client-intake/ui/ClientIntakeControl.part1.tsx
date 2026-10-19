import { eventCallback as $callback } from '@frontend/shared/lib/component-events';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import ChannelIntakeControls from './ChannelIntakeControls';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ClientIntakeControl.model';
export function renderClientIntakeControlPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const control = $unref($state.control);

  return (
    <>
      {control.loading.value ? (
        <p role="status" className="intake-control-state" data-r-77f00789="">
          {' Проверяем режим работы… '}
        </p>
      ) : control.state.value ? (
        <ChannelIntakeControls
          pendingChannel={control.pendingChannel.value}
          channels={$props.channels}
          state={control.state.value}
          onChange={$callback($required($unref($state.control)).changeMode)}
          data-r-77f00789=""
        />
      ) : null}
    </>
  );
}
