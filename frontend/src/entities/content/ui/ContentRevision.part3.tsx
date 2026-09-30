import { renderContentRevisionPart4 } from './ContentRevision.part4';

import type { createComponentModel } from './ContentRevision.model';
export function renderContentRevisionPart3(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { visibility } = $state;

  return (
    <>
      <section data-r-b485ff3e="">
        <h3 data-r-b485ff3e="">
          {' Частые вопросы '}
          <small data-r-b485ff3e="">{visibility('faq')}</small>
        </h3>
        {renderContentRevisionPart4($state)}
      </section>
    </>
  );
}
