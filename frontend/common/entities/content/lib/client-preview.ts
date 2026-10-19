import { clientMessages } from '@core/application/client-messages';
import {
  renderClassAction,
  type ClassResponse,
} from '@core/application/class-navigation';
import { previewClassInformation } from './class-preview';
import {
  buildClientResponsePreviews,
  buildTelegramMenuPreviewRows,
} from './client-response-preview';
import type { ContentDraft } from '@frontend-common/entities/content/model/types';

export function clientPreview(content: ContentDraft, action: string) {
  const responses = buildClientResponsePreviews(content);
  let response: ClassResponse;
  const label = action.slice('reply:'.length);
  const selected =
    action !== 'main'
      ? responses.find((item) => item.label === label)
      : undefined;
  if (action.startsWith('classes:')) {
    response = renderClassAction(previewClassInformation(content), action);
  } else if (
    action !== 'main' &&
    label === 'Расписание' &&
    (content.directions.length || content.groups.length)
  ) {
    response = renderClassAction(
      previewClassInformation(content),
      'classes:directions:0',
    );
  } else if (selected || (action !== 'main' && label === 'Задать вопрос')) {
    response = {
      text: selected?.text ?? clientMessages.questionPrompt,
      buttons: [{ label: 'Меню', action: 'main', command: 'Меню' }],
      ...(selected?.mode === 'application'
        ? { applicationLabel: selected.label }
        : {}),
      ...(!selected ? { beginQuestion: true } : {}),
    };
  } else {
    response = {
      text: clientMessages.greeting,
      buttons: buildTelegramMenuPreviewRows(responses)
        .flat()
        .map((label) => ({ label, command: label, action: `reply:${label}` })),
    };
  }
  const buttonRows =
    action === 'main'
      ? buildTelegramMenuPreviewRows(responses).map((row) =>
          row.map((label) =>
            response.buttons.find((item) => item.label === label)!,
          ),
        )
      : response.buttons.map((button) => [button]);
  return { response, buttonRows, empty: responses.length === 0 };
}
