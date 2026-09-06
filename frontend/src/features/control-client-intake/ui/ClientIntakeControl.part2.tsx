import {
  eventCallback as $callback,
  nativeHandler as $nativeHandler,
} from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';
import ChannelIntakeControls from './ChannelIntakeControls';

import type { createComponentModel } from './ClientIntakeControl.model';
export function renderClientIntakeControlPart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const control = $unref($state.control);

  return (
    <>
      <div className="intake-control-body" data-r-77f00789="">
        <p className="intake-control-intro" data-r-77f00789="">
          {
            ' Можно приостановить новые обращения из одного канала. Текущие обращения продолжат работать. '
          }
        </p>
        <AsyncMessage
          kind="error"
          text={control.error.value}
          data-r-77f00789=""
        />
        <AsyncMessage
          kind="success"
          text={control.notice.value}
          data-r-77f00789=""
        />
        {control.error.value && !control.state.value ? (
          <button
            type="button"
            disabled={control.loading.value}
            onClick={$nativeHandler($required($unref($state.control)).load)}
            className="secondary-button"
            data-r-77f00789=""
          >
            {' Повторить проверку '}
          </button>
        ) : null}
        {control.loading.value ? (
          <p role="status" className="intake-control-state" data-r-77f00789="">
            {' Проверяем режим работы… '}
          </p>
        ) : control.state.value ? (
          <ChannelIntakeControls
            pendingChannel={control.pendingChannel.value}
            state={control.state.value}
            onChange={$callback($required($unref($state.control)).changeMode)}
            data-r-77f00789=""
          />
        ) : null}
      </div>
    </>
  );
}
