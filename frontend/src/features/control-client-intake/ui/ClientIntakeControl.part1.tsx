import { classNames as $class } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import type { createComponentModel } from './ClientIntakeControl.model';
export function renderClientIntakeControlPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const control = $unref($state.control);

  return (
    <>
      <summary className="intake-control-summary" data-r-77f00789="">
        <div data-r-77f00789="">
          <p className="eyebrow" data-r-77f00789="">
            {'Управление каналами'}
          </p>
          <h2 data-r-77f00789="">{'Новые обращения'}</h2>
        </div>
        <div className="intake-control-summary-meta" data-r-77f00789="">
          <span
            className={$class(
              'intake-summary-status',
              `intake-summary-status--${control.summaryStatus.value.tone}`,
            )}
            data-r-77f00789=""
          >
            {control.summaryStatus.value.label}
          </span>
          <span className="intake-summary-action" data-r-77f00789="">
            <span className="intake-summary-action--open" data-r-77f00789="">
              {'Открыть управление'}
            </span>
            <span className="intake-summary-action--close" data-r-77f00789="">
              {'Скрыть управление'}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="disclosure-chevron"
            data-r-77f00789=""
          />
        </div>
      </summary>
    </>
  );
}
