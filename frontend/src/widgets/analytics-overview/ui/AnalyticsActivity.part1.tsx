import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './AnalyticsActivity.model';
export function renderAnalyticsActivityPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { x, label } = $state;
  const points = $unref($state.points);
  const maximum = $state.maximum.value;
  const ticks = $state.ticks.value;

  return (
    <>
      <svg
        viewBox="0 0 700 225"
        role="img"
        aria-label="Динамика действий меню и обращений. Точные значения доступны в таблице ниже."
        className="activity-chart"
        data-r-163b6de6=""
      >
        {$renderList([0, 0.5, 1], (fraction) => (
          <g key={fraction} data-r-163b6de6="">
            <line
              x1="48"
              x2="652"
              y1={190 - fraction * 160}
              y2={190 - fraction * 160}
              className="grid-line"
              data-r-163b6de6=""
            />
            <text
              x="38"
              y={195 - fraction * 160}
              text-anchor="end"
              data-r-163b6de6=""
            >
              {Math.round(maximum * fraction)}
            </text>
          </g>
        ))}
        <polyline
          points={points('menuActions')}
          className="menu-line"
          data-r-163b6de6=""
        />
        <polyline
          points={points('requests')}
          className="request-line"
          data-r-163b6de6=""
        />
        {$renderList(ticks, (index) => (
          <text
            key={index}
            x={x(index)}
            y="218"
            text-anchor={
              index === 0
                ? 'start'
                : index === $props.daily.length - 1
                  ? 'end'
                  : 'middle'
            }
            data-r-163b6de6=""
          >
            {$props.daily[index] ? label($props.daily[index].date) : ''}
          </text>
        ))}
      </svg>
    </>
  );
}
