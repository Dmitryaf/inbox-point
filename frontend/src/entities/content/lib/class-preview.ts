import {
  formatListResponse,
  type ClientInformationResolver,
} from '@core/application/client-information';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { renderClassAction } from '@core/application/class-navigation';

export function previewClassInformation(
  content: ContentDraft,
): ClientInformationResolver {
  return {
    getContent: () => content,
    getCustomSections: () => [],
    getInformationButtons: () => [],
    isStaleMenuAction: () => false,
    resolve: () =>
      content.prices.trim()
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
