import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { RouterLink } from '@frontend/shared/lib/router';

import type { createComponentModel } from './OperationsAttentionPanel.model';
export function renderOperationsAttentionPanelPart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const channelProblems = $state.channelProblems.value;
  const hasAttention = $state.hasAttention.value;
  if (!hasAttention) {
    return null;
  }
  return (
    <>
      {channelProblems.length ? (
        <div className="attention-list" data-r-a910a991="">
          {$renderList(channelProblems, (problem) => (
            <article key={problem.name} data-r-a910a991="">
              <h3 data-r-a910a991="">{problem.name}</h3>
              <p data-r-a910a991="">{problem.summary}</p>
              <p data-r-a910a991="">{problem.action}</p>
              <RouterLink to="/setup" data-r-a910a991="">
                {'Открыть «Каналы»'}
              </RouterLink>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
