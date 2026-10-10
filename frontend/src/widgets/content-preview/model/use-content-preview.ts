import { computed, ref, watch } from 'vue';
import { clientMessages } from '@core/application/client-messages';
import {
  renderClassAction,
  type ClassResponse,
} from '@core/application/class-navigation';
import { previewClassInformation } from '@frontend/entities/content/lib/class-preview';
import {
  buildClientResponsePreviews,
  buildTelegramMenuPreviewRows,
} from '@frontend/entities/content/lib/client-response-preview';
import type { ContentDraft } from '@frontend/entities/content/model/types';

export function useContentPreview(props: {
  content: ContentDraft;
  startAction?: string | undefined;
}) {
  const action = ref(props.startAction ?? 'main');
  watch(
    () => props.startAction,
    (value) => {
      action.value = value ?? 'main';
    },
  );
  const responses = computed(() => buildClientResponsePreviews(props.content));
  const response = computed<ClassResponse>(() => {
    if (action.value.startsWith('classes:')) {
      return renderClassAction(
        previewClassInformation(props.content),
        action.value,
      );
    }
    const label = action.value.slice('reply:'.length);
    if (
      action.value !== 'main' &&
      label === 'Расписание' &&
      (props.content.directions.length || props.content.groups.length)
    ) {
      return renderClassAction(
        previewClassInformation(props.content),
        'classes:directions:0',
      );
    }
    const selected =
      action.value !== 'main'
        ? responses.value.find((item) => item.label === label)
        : undefined;
    if (selected || (action.value !== 'main' && label === 'Задать вопрос')) {
      return {
        text: selected?.text ?? clientMessages.questionPrompt,
        buttons: [{ label: 'Меню', action: 'main', command: 'Меню' }],
        ...(selected?.mode === 'application'
          ? { applicationLabel: selected.label }
          : {}),
        ...(!selected ? { beginQuestion: true } : {}),
      };
    }
    return {
      text: clientMessages.greeting,
      buttons: buildTelegramMenuPreviewRows(responses.value)
        .flat()
        .map((label) => ({ label, command: label, action: `reply:${label}` })),
    };
  });
  const buttonRows = computed(() => {
    const buttons = response.value.buttons;
    if (action.value === 'main') {
      return buildTelegramMenuPreviewRows(responses.value).map((row) =>
        row.map((label) => buttons.find((item) => item.label === label)!),
      );
    }
    return buttons.map((button) => [button]);
  });
  return {
    action,
    response,
    buttonRows,
    empty: computed(() => responses.value.length === 0),
  };
}
