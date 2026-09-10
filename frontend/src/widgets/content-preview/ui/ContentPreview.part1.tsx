import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { createComponentModel } from './ContentPreview.model';
export function renderContentPreviewPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const responses = $state.responses.value;

  return (
    <>
      {responses.length === 0 ? (
        <p className="empty" data-r-e038eaba="">
          {' Заполните разделы — здесь появится будущий ответ. '}
        </p>
      ) : (
        <div
          aria-label="Пример переписки"
          className="message-preview"
          data-r-e038eaba=""
        >
          <div className="message-preview-menu" data-r-e038eaba="">
            <p data-r-e038eaba="">{'Здравствуйте! Чем помочь?'}</p>
            <div
              aria-label="Кнопки меню"
              className="message-preview-buttons"
              data-r-e038eaba=""
            >
              {$renderList(responses, (response) => (
                <span key={response.label} data-r-e038eaba="">
                  {response.label}
                </span>
              ))}
              <span data-r-e038eaba="">{'Задать вопрос'}</span>
            </div>
          </div>
          {$renderList(responses, (response) => (
            <article
              key={response.label}
              className="preview-response"
              data-r-e038eaba=""
            >
              <p className="preview-client-message" data-r-e038eaba="">
                {response.label}
              </p>
              <p className="preview-service-message" data-r-e038eaba="">
                {response.text}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
