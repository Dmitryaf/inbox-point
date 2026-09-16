import * as React from 'react';
import type { ElementProps } from '@frontend/shared/lib/component-attributes';

export function renderOperatorRelayIncidentListPart1Layout2(
  elementProps1: ElementProps<'section'>,
  content2: React.ReactNode,
) {
  return (
    <section {...elementProps1}>
      <h3 id="operator-relay-incidents-title" data-r-e2822c38="">
        {'Действия в Telegram'}
      </h3>
      <p data-r-e2822c38="">
        {'Проверьте фактическое состояние темы перед выбором действия.'}
      </p>
      <ol data-r-e2822c38="">{content2}</ol>
    </section>
  );
}
