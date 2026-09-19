import {
  type ClientInformationContent,
  hasValidClientInformationResponses,
  hasValidCustomSections,
  hasValidFaqItems,
  hasValidScheduleItems,
} from '@/core/application/client-information.js';
import { formatScheduleCompatibilityText } from '@/core/application/schedule-response.js';
import type { ContentPayload } from './schema.js';

export function validateContent(
  value: ContentPayload,
): ClientInformationContent {
  const content = pickContent(value);
  if (
    (value.scheduleItems?.length &&
      value.schedule !==
        formatScheduleCompatibilityText(content.schedule ?? [])) ||
    !hasValidCustomSections(content.customSections ?? []) ||
    !hasValidFaqItems(content.faq ?? []) ||
    !hasValidScheduleItems(content.schedule ?? []) ||
    !hasValidClientInformationResponses(content)
  ) {
    throw new Error('The local content settings are invalid');
  }
  return content;
}

export function pickContent(value: ContentPayload): ClientInformationContent {
  return {
    ...(value.address ? { address: value.address } : {}),
    ...(value.customSections
      ? {
          customSections: value.customSections.map((section) => ({
            ...section,
          })),
        }
      : {}),
    ...(value.faq ? { faq: value.faq.map((item) => ({ ...item })) } : {}),
    ...(value.prices ? { prices: value.prices } : {}),
    ...(value.scheduleItems
      ? {
          schedule: value.scheduleItems.map((item) => ({
            dayTime: item.dayTime,
            ...(item.description ? { description: item.description } : {}),
            title: item.title,
          })),
        }
      : value.schedule
        ? { legacySchedule: value.schedule }
        : {}),
    ...(value.visibleSections
      ? { visibleSections: [...value.visibleSections] }
      : {}),
  };
}

export function toContentPayload(
  value: ClientInformationContent,
): ContentPayload {
  const { legacySchedule, schedule } = value;
  return {
    ...(value.address ? { address: value.address } : {}),
    ...(value.customSections
      ? { customSections: value.customSections.map((item) => ({ ...item })) }
      : {}),
    ...(value.faq ? { faq: value.faq.map((item) => ({ ...item })) } : {}),
    ...(value.prices ? { prices: value.prices } : {}),
    ...(schedule?.length
      ? {
          schedule: formatScheduleCompatibilityText(schedule),
          scheduleItems: schedule.map((item) => ({ ...item })),
        }
      : legacySchedule
        ? { schedule: legacySchedule }
        : {}),
    ...(value.visibleSections
      ? { visibleSections: [...value.visibleSections] }
      : {}),
  };
}
