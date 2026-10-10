import {
  formatListResponse,
  type ClientInformationResolver,
} from '@core/application/client-information';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { renderClassAction } from '@core/application/class-navigation';
import { formatClassSchedule } from '@core/application/class-schedule';

export function previewClassInformation(
  content: ContentDraft,
): ClientInformationResolver {
  return {
    getContent: () => content,
    getCustomSections: () => [],
    getInformationButtons: () => [],
    isStaleMenuAction: () => false,
    resolve: (label) =>
      label === 'Расписание'
        ? formatClassSchedule(content)
        : content.prices.trim()
          ? formatListResponse('Цены', content.prices)
          : 'Цены пока не указаны.',
  };
}
export function previewClassSchedule(content: ContentDraft): string {
  const response = renderClassAction(
    previewClassInformation(content),
    'classes:directions:0',
  );
  return (
    response.text +
    '\n' +
    response.buttons.map((item) => item.label).join(' · ')
  );
}
