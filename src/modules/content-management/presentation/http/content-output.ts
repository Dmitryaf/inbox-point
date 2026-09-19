import { formatScheduleCompatibilityText } from '@/core/application/schedule-response.js';
import type { ManagedContentSnapshot } from '@/modules/content-management/application/content-management-service.js';

export function createContentOutput(snapshot: ManagedContentSnapshot): object {
  const { legacySchedule, schedule, ...content } = snapshot.content;
  return {
    content: {
      ...content,
      schedule:
        legacySchedule ??
        (schedule?.length ? formatScheduleCompatibilityText(schedule) : ''),
      scheduleItems: schedule?.map((item) => ({ ...item })) ?? [],
    },
    version: snapshot.version,
  };
}
