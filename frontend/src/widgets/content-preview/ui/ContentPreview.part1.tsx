import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import type { createComponentModel } from './ContentPreview.model';
export function renderContentPreviewPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const responses = $state.responses.value;
  const buttonRows = $state.buttonRows.value;

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
          <div
            aria-label="Кнопки меню Telegram"
            className="message-preview-buttons"
            data-r-e038eaba=""
          >
            {$renderList(buttonRows, (row, rowIndex) => (
              <div
                key={rowIndex}
                className={$class('message-preview-button-row', {
                  'message-preview-button-row--single': row.length === 1,
                })}
                data-r-e038eaba=""
              >
                {$renderList(row, (label) => (
                  <span key={label} data-r-e038eaba="">
                    {label}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
