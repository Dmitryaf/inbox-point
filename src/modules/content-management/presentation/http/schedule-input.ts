import type { ClientInformationContent } from '@/core/application/client-information.js';
import { formatScheduleCompatibilityText } from '@/core/application/schedule-response.js';

export function hasLegacyScheduleConflict(
  content: {
    schedule: string;
    scheduleItems?: readonly unknown[] | undefined;
  },
  current: ClientInformationContent,
): boolean {
  return Boolean(
    content.scheduleItems === undefined &&
    current.schedule?.length &&
    content.schedule !== formatScheduleCompatibilityText(current.schedule),
  );
}
