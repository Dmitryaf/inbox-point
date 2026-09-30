import { renderContentRevisionPart6 } from './ContentRevision.part6';

import type { createComponentModel } from './ContentRevision.model';
export function renderContentRevisionPart5(
  $state: ReturnType<typeof createComponentModel>,
) {
  return (
    <>
      <section data-r-b485ff3e="">
        <h3 data-r-b485ff3e="">{'Свои разделы'}</h3>
        {renderContentRevisionPart6($state)}
      </section>
    </>
  );
}
