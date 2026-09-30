import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { createComponentModel } from './ContentRevision.model';
export function renderContentRevisionPart6(
  $state: ReturnType<typeof createComponentModel>,
) {
  const content = $state.content.value;

  return (
    <>
      {content.customSections.length ? (
        <ul data-r-b485ff3e="">
          {$renderList(content.customSections, (item, index) => (
            <li key={index} data-r-b485ff3e="">
              <strong data-r-b485ff3e="">{item.label}</strong>
              <p data-r-b485ff3e="">{item.text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p data-r-b485ff3e="">{'Не заполнено'}</p>
      )}
    </>
  );
}
