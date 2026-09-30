import { renderContentRevisionPart2 } from './ContentRevision.part2';

import type { createComponentModel } from './ContentRevision.model';
export function renderContentRevisionPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { visibility } = $state;

  return (
    <>
      <section data-r-b485ff3e="">
        <h3 data-r-b485ff3e="">
          {' Расписание '}
          <small data-r-b485ff3e="">{visibility('schedule')}</small>
        </h3>
        {renderContentRevisionPart2($state)}
      </section>
    </>
  );
}
