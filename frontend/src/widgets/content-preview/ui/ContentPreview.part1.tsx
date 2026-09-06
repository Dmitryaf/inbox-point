import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { createComponentModel } from './ContentPreview.model';
export function renderContentPreviewPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const responses = $state.responses.value;

  return (
    <>
      {responses.length === 0 ? (
        <p className="empty">
          {' Заполните разделы — здесь появится будущий ответ. '}
        </p>
      ) : (
        $renderList(responses, (response) => (
          <article key={response.label} className="preview-response">
            <p className="preview-response-label">
              {'Кнопка «'}
              {response.label}
              {'»'}
            </p>
            <p className="preserve">{response.text}</p>
          </article>
        ))
      )}
    </>
  );
}
