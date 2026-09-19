export const scheduleResponseTitle = 'Расписание';

export interface ScheduleItem {
  dayTime: string;
  description?: string;
  title: string;
}

export function formatScheduleBody(items: readonly ScheduleItem[]): string {
  return items
    .map((item) =>
      [
        item.title,
        `День / время: ${item.dayTime}`,
        ...(item.description ? [item.description] : []),
      ].join('\n'),
    )
    .join('\n\n');
}

export function formatScheduleResponse(items: readonly ScheduleItem[]): string {
  return `${scheduleResponseTitle}\n\n${formatScheduleBody(items)}`;
}

export function formatScheduleCompatibilityText(
  items: readonly ScheduleItem[],
): string {
  return items
    .map((item) =>
      [
        item.title,
        item.dayTime,
        ...(item.description ? [item.description.replace(/\r?\n/gu, ' ')] : []),
      ].join(' — '),
    )
    .join('\n');
}
