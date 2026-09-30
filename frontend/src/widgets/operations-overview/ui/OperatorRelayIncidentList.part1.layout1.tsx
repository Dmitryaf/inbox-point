import * as React from 'react';
import type { ElementProps } from '@frontend/shared/lib/component-attributes';

import OperatorRelayIncidentActions from './OperatorRelayIncidentActions';

export function renderOperatorRelayIncidentListPart1Layout1(
  elementProps1: ElementProps<'li', 'key'>,
  content2: React.ReactNode,
  elementProps3: ElementProps<'time', 'dateTime'>,
  content4: React.ReactNode,
  content5: React.ReactNode,
  content6: React.ReactNode,
  content7: React.ReactNode,
  content8: React.ReactNode,
  content9: React.ReactNode,
  content10: React.ReactNode,
  content11: React.ReactNode,
  content12: React.ReactNode,
  content13: React.ReactNode,
  content14: React.ReactNode,
  content15: React.ReactNode,
  elementProps16: ElementProps<
    typeof OperatorRelayIncidentActions,
    'incident' | 'pendingActionId' | 'onResolve'
  >,
) {
  return (
    <li {...elementProps1} data-r-e2822c38="">
      <div className="delivery-incident-heading" data-r-e2822c38="">
        <strong data-r-e2822c38="">{content2}</strong>
        <time {...elementProps3} data-r-e2822c38="">
          {content4}
        </time>
      </div>
      {content5}
      {content6}
      <p className="incident-client" data-r-e2822c38="">
        <strong data-r-e2822c38="">
          {' Клиент: '}
          {content7}
          {' · '}
          {content8}
        </strong>
      </p>
      {content9}
      <details className="technical-details" data-r-e2822c38="">
        <summary data-r-e2822c38="">{'Технические данные'}</summary>
        <dl className="delivery-incident-context" data-r-e2822c38="">
          <div data-r-e2822c38="">
            <dt data-r-e2822c38="">{'ID обращения'}</dt>
            <dd data-r-e2822c38="">{content10}</dd>
          </div>
          <div data-r-e2822c38="">
            <dt data-r-e2822c38="">{'Причина'}</dt>
            <dd data-r-e2822c38="">{content11}</dd>
          </div>
          <div data-r-e2822c38="">
            <dt data-r-e2822c38="">{content12}</dt>
            <dd data-r-e2822c38="">{content13}</dd>
          </div>
          {content14}
          <div data-r-e2822c38="">
            <dt data-r-e2822c38="">{'Операция'}</dt>
            <dd data-r-e2822c38="">{content15}</dd>
          </div>
        </dl>
      </details>
      <OperatorRelayIncidentActions
        {...elementProps16}

        data-r-e2822c38=""
      />
    </li>
  );
}
