import * as React from 'react';
import type { ElementProps } from '@frontend/shared/lib/component-attributes';

export function renderDeliveryIncidentListPart1Layout1(
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
) {
  return (
    <li {...elementProps1} data-r-d17d69f5="">
      <div className="delivery-incident-heading" data-r-d17d69f5="">
        <strong data-r-d17d69f5="">{content2}</strong>
        <time {...elementProps3} data-r-d17d69f5="">
          {content4}
        </time>
      </div>
      {content5}
      <p className="incident-client" data-r-d17d69f5="">
        <strong data-r-d17d69f5="">
          {' Клиент: '}
          {content6}
          {' · '}
          {content7}
        </strong>
      </p>
      <div className="incident-message" data-r-d17d69f5="">
        <strong data-r-d17d69f5="">{'Ответ клиенту'}</strong>
        <p data-r-d17d69f5="">{content8}</p>
      </div>
      <details className="technical-details" data-r-d17d69f5="">
        <summary data-r-d17d69f5="">{'Технические данные'}</summary>
        <dl className="delivery-incident-context" data-r-d17d69f5="">
          <div data-r-d17d69f5="">
            <dt data-r-d17d69f5="">{'ID обращения'}</dt>
            <dd data-r-d17d69f5="">{content9}</dd>
          </div>
          <div data-r-d17d69f5="">
            <dt data-r-d17d69f5="">{'ID темы в Telegram'}</dt>
            <dd data-r-d17d69f5="">{content10}</dd>
          </div>
          {content11}
          <div data-r-d17d69f5="">
            <dt data-r-d17d69f5="">{'Причина'}</dt>
            <dd data-r-d17d69f5="">{content12}</dd>
          </div>
        </dl>
      </details>
      {content13}
    </li>
  );
}
