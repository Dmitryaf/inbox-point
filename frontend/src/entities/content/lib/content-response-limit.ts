import {
  formatAddressResponse,
  formatFaqResponse,
  formatListResponse,
  normalizeFaqItems,
} from '@frontend/entities/content/lib/client-response-preview';
import {
  formatScheduleCompatibilityResponse,
  formatScheduleResponse,
  normalizeScheduleItems,
} from '@frontend/entities/content/lib/schedule-response';
import type { ContentDraft } from '@frontend/entities/content/model/types';

const messageLengthLimit = 4_000;

interface ContentResponse {
  fieldId: string;
  label: string;
  section: 'core' | 'custom' | 'faq';
  text: string;
}

export function findOversizedContentResponse(
  content: ContentDraft,
): ContentResponse | undefined {
  const responses: (ContentResponse | undefined)[] = [
    createScheduleResponse(content),
    createScheduleCompatibilityResponse(content),
    createListResponse('prices', 'Цены', content.prices),
    content.address.trim()
      ? {
          fieldId: 'address',
          label: 'Адрес',
          section: 'core',
          text: formatAddressResponse(content.address),
        }
      : undefined,
    normalizeFaqItems(content.faq).length > 0
      ? {
          fieldId: 'faq-answer-0',
          label: 'Частые вопросы',
          section: 'faq',
          text: formatFaqResponse(normalizeFaqItems(content.faq)),
        }
      : undefined,
    ...content.customSections.map((section, index) => ({
      fieldId: `section-text-${index}`,
      label: section.label.trim(),
      section: 'custom' as const,
      text: section.text.trim(),
    })),
  ];
  return responses.find(
    (response) =>
      response !== undefined && response.text.length > messageLengthLimit,
  );
}

export function getCoreResponseLengths(content: ContentDraft): {
  address: number;
  prices: number;
  schedule: number;
} {
  return {
    address: content.address.trim()
      ? formatAddressResponse(content.address).length
      : 0,
    prices:
      createListResponse('prices', 'Цены', content.prices)?.text.length ?? 0,
    schedule: createScheduleResponse(content)?.text.length ?? 0,
  };
}

function createScheduleCompatibilityResponse(
  content: ContentDraft,
): ContentResponse | undefined {
  const schedule = normalizeScheduleItems(content.schedule);
  return schedule.length > 0
    ? {
        fieldId: 'schedule-title-0',
        label: 'Расписание',
        section: 'core',
        text: formatScheduleCompatibilityResponse(schedule),
      }
    : undefined;
}

function createListResponse(
  fieldId: 'prices',
  label: 'Цены',
  text: string,
): ContentResponse | undefined {
  return text.trim()
    ? { fieldId, label, section: 'core', text: formatListResponse(label, text) }
    : undefined;
}

function createScheduleResponse(
  content: ContentDraft,
): ContentResponse | undefined {
  const schedule = normalizeScheduleItems(content.schedule);
  if (schedule.length > 0) {
    return {
      fieldId: 'schedule-title-0',
      label: 'Расписание',
      section: 'core',
      text: formatScheduleResponse(schedule),
    };
  }
  return content.legacySchedule.trim()
    ? {
        fieldId: 'legacy-schedule',
        label: 'Расписание',
        section: 'core',
        text: formatListResponse('Расписание', content.legacySchedule),
      }
    : undefined;
}
