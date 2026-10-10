import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { setModelValue as $set } from '@frontend/shared/lib/component-bindings';

import type { createComponentModel } from './ContentPreview.model';
export function renderContentPreviewPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const response = $unref($state.response);
  const buttonRows = $unref($state.buttonRows);

  return (
    <>
      <div
        aria-label="Пример переписки"
        className="message-preview"
        data-r-e038eaba=""
      >
        <article
          aria-live="polite"
          className="preview-response"
          data-r-e038eaba=""
        >
          <p className="preview-service-message" data-r-e038eaba="">
            {response.text}
          </p>
          {response.applicationLabel ? (
            <p className="preview-intro" data-r-e038eaba="">
              {
                ' Здесь клиент напишет ответ. Он придёт администратору как заявка «'
              }
              {response.applicationLabel}
              {'». '}
            </p>
          ) : response.beginQuestion ? (
            <p className="preview-intro" data-r-e038eaba="">
              {' Следующее сообщение клиента придёт администратору'}
              {response.questionContext ? ' вместе с названием группы' : ''}
              {'. '}
            </p>
          ) : null}
        </article>
        <div
          aria-label="Кнопки бота"
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
              {$renderList(row, (button) => (
                <button
                  key={button.action}
                  type="button"
                  onClick={() => void $set($state, 'action', button.action)}
                  className="secondary-button"
                  data-r-e038eaba=""
                >
                  {button.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
