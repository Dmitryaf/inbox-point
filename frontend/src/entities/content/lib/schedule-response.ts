import type { ScheduleItem } from '@frontend/entities/content/model/types';

export {
  formatScheduleCompatibilityResponse,
  formatScheduleResponse,
} from '@core/application/schedule-response';

export function normalizeScheduleItems(
  items: readonly ScheduleItem[],
): ScheduleItem[] {
  return items
    .map((item) => ({
      dayTime: item.dayTime.trim(),
      ...(item.description?.trim()
        ? { description: item.description.trim() }
        : {}),
      title: item.title.trim(),
    }))
    .filter((item) => item.title || item.dayTime || item.description);
}
