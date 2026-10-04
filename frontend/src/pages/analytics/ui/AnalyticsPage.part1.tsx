import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { setModelValue as $set } from '@frontend/shared/lib/component-bindings';

import type { createComponentModel } from './AnalyticsPage.model';
export function renderAnalyticsPagePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const period = $unref($state.period);
  const periods = $unref($state.periods);
  const channel = $unref($state.channel);
  const channels = $unref($state.channels);

  return (
    <>
      <div className="analytics-filters" data-r-53e74af6="">
        <div role="group" aria-label="Период" data-r-53e74af6="">
          {$renderList(periods, (item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={period === item.value}
              onClick={() => void $set($state, 'period', item.value)}
              className="quiet"
              data-r-53e74af6=""
            >
              {item.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Канал" data-r-53e74af6="">
          {$renderList(channels, (item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={channel === item.value}
              onClick={() => void $set($state, 'channel', item.value)}
              className="quiet"
              data-r-53e74af6=""
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
