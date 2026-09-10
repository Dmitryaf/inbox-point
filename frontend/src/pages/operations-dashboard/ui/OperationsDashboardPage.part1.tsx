import { templateRef as $templateRef } from '@frontend/shared/lib/component-view';
import {
  eventCallback as $callback,
  nativeHandler as $nativeHandler,
} from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl';

import OperatorInbox from '@frontend/widgets/operator-inbox/ui/OperatorInbox';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import { renderOperationsDashboardPagePart2 } from './OperationsDashboardPage.part2';
import type { ModelScope } from '@frontend/shared/lib/model-state';

import type { createComponentModel } from './OperationsDashboardPage.model';
export function renderOperationsDashboardPagePart1(
  $state: ReturnType<typeof createComponentModel>,
  $scope: ModelScope,
) {
  const session = $unref($state.session);
  const operations = $unref($state.operations);
  const deliveryControl = $unref($state.deliveryControl);
  const deliveryRetry = $unref($state.deliveryRetry);
  const operatorResolution = $unref($state.operatorResolution);
  const inboundEventResolution = $unref($state.inboundEventResolution);

  return (
    <>
      {session.booting.value ? (
        <section role="status" className="card loading-card" data-r-fef838bc="">
          <p data-r-fef838bc="">{'Проверяем доступ…'}</p>
        </section>
      ) : session.authenticated.value ? (
        <section className="ops-workspace" data-r-fef838bc="">
          {session.error.value ? (
            <p
              role="alert"
              className="message message--error card"
              data-r-fef838bc=""
            >
              {session.error.value}
            </p>
          ) : null}
          {operations.error.value ? (
            <p
              role="alert"
              className="message message--error card"
              data-r-fef838bc=""
            >
              {operations.error.value}
            </p>
          ) : null}
          {renderOperationsDashboardPagePart2($state)}
          <div className="toolbar" data-r-fef838bc="">
            <p data-r-fef838bc="">
              {'Данные обновляются автоматически каждые 30 секунд.'}
            </p>
            <button
              disabled={operations.loading.value}
              type="button"
              onClick={$nativeHandler($unref($state.refreshAll))}
              className="secondary-button"
              data-r-fef838bc=""
            >
              {operations.loading.value ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>
          <ClientIntakeControl
            onChanged={$callback($unref($state.refreshAll))}
            onUnauthorized={$callback(
              $required($unref($state.session)).expireSession,
            )}
            ref={$templateRef($state, 'intakeControl', $scope)}
            data-r-fef838bc=""
          />
          <AsyncMessage
            kind="error"
            text={deliveryRetry.error.value}
            data-r-fef838bc=""
          />
          <AsyncMessage
            kind="success"
            text={deliveryRetry.notice.value}
            data-r-fef838bc=""
          />
          <AsyncMessage
            kind="error"
            text={operatorResolution.error.value}
            data-r-fef838bc=""
          />
          <AsyncMessage
            kind="success"
            text={operatorResolution.notice.value}
            data-r-fef838bc=""
          />
          <AsyncMessage
            kind="error"
            text={deliveryControl.error.value}
            data-r-fef838bc=""
          />
          <AsyncMessage
            kind="success"
            text={deliveryControl.notice.value}
            data-r-fef838bc=""
          />
          <OperatorInbox
            onUnauthorized={session.expireSession}
            ref={$templateRef($state, 'operatorInbox', $scope)}
            data-r-fef838bc=""
          />
          <AsyncMessage
            kind="error"
            text={inboundEventResolution.error.value}
            data-r-fef838bc=""
          />
          <AsyncMessage
            kind="success"
            text={inboundEventResolution.notice.value}
            data-r-fef838bc=""
          />
        </section>
      ) : null}
    </>
  );
}
