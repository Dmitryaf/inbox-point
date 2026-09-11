import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './ConnectionSetupGuide.model';
export function renderConnectionSetupGuidePart2(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <ol className="connection-guide-steps" data-r-cf5827f2="">
        {$renderList($props.problems, (problem, index) => (
          <li key={problem.channel} data-r-cf5827f2="">
            <span className="connection-step-number" data-r-cf5827f2="">
              {index + 1}
            </span>
            <div data-r-cf5827f2="">
              <strong data-r-cf5827f2="">{problem.channel}</strong>
              <p data-r-cf5827f2="">{problem.action}</p>
            </div>
            <span className="connection-step-status" data-r-cf5827f2="">
              {'Не подключён'}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
