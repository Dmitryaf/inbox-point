import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { createComponentModel } from './ContentRevision.model';
export function renderContentRevisionPart4(
  $state: ReturnType<typeof createComponentModel>,
) {
  const content = $state.content.value;

  return (
    <>
      {content.faq.length ? (
        <ul data-r-b485ff3e="">
          {$renderList(content.faq, (item, index) => (
            <li key={index} data-r-b485ff3e="">
              <strong data-r-b485ff3e="">{item.question}</strong>
              <p data-r-b485ff3e="">{item.answer}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p data-r-b485ff3e="">{'Не заполнено'}</p>
      )}
    </>
  );
}
