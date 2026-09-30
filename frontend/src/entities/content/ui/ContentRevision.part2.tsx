import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import type { createComponentModel } from './ContentRevision.model';
export function renderContentRevisionPart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const content = $state.content.value;

  return (
    <>
      {content.schedule.length ? (
        <ul data-r-b485ff3e="">
          {$renderList(content.schedule, (item, index) => (
            <li key={index} data-r-b485ff3e="">
              <strong data-r-b485ff3e="">{item.title}</strong>
              <p data-r-b485ff3e="">{item.dayTime}</p>
              {item.description ? (
                <p data-r-b485ff3e="">{item.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p data-r-b485ff3e="">
          {$or(content.legacySchedule, () => 'Не заполнено')}
        </p>
      )}
    </>
  );
}
