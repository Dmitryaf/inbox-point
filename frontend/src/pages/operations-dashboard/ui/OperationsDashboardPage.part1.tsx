import {
  classNames as $class,
  templateRef as $templateRef,
} from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import OperatorInbox from '@frontend/widgets/operator-inbox/ui/OperatorInbox';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import { renderOperationsDashboardPagePart2 } from './OperationsDashboardPage.part2';
import { renderOperationsDashboardPagePart3 } from './OperationsDashboardPage.part3';
import type { ModelScope } from '@frontend/shared/lib/model-state';
import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperationsDashboardPage.model';
export function renderOperationsDashboardPagePart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
  $scope: ModelScope,
) {
  const refreshError = $unref($state.refreshError);
  const operations = $unref($state.operations);
  const session = $unref($state.session);
  const deliveryRetry = $unref($state.deliveryRetry);
  const operatorResolution = $unref($state.operatorResolution);
  const inboundEventResolution = $unref($state.inboundEventResolution);
  const deliveryControl = $unref($state.deliveryControl);
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {session.authenticated.value ? (
        <section
          {...$attributes}
          className={$class('ops-workspace', $attributes.className)}
          data-r-fef838bc=""
        >
          {refreshError ? (
            <section
              role="alert"
              className="message message--error card ops-refresh-error"
              data-r-fef838bc=""
            >
              <p data-r-fef838bc="">{refreshError}</p>
              <button
                type="button"
                disabled={operations.loading.value}
                onClick={$nativeHandler($unref($state.refreshAll))}
                className="quiet"
                data-r-fef838bc=""
              >
                {' Повторить проверку '}
              </button>
            </section>
          ) : null}
          <div className="ops-toolbar" data-r-fef838bc="">
            <p data-r-fef838bc="">{'Автообновление каждые 30 секунд'}</p>
            <button
              disabled={operations.loading.value}
              type="button"
              onClick={$nativeHandler($unref($state.refreshAll))}
              className="quiet"
              data-r-fef838bc=""
            >
              {operations.loading.value ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>
          <OperatorInbox
            onUnauthorized={session.expireSession}
            ref={$templateRef($state, 'operatorInbox', $scope)}
            data-r-fef838bc=""
          />
          {renderOperationsDashboardPagePart2($state)}
          {renderOperationsDashboardPagePart3($state, $scope)}
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
