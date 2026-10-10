import type { ClassContent } from './class-content.js';

export function formatClassSchedule(content: ClassContent): string {
  return (
    'Расписание\n\n' +
    (content.groups ?? [])
      .map(
        (group) =>
          group.review?.source ??
          `${content.directions?.find((direction) => direction.id === group.directionId)?.name ?? ''} / ${group.name}\n${group.meetings.join('\n')}${group.description ? '\n' + group.description : ''}`,
      )
      .join('\n\n')
  );
}

export function classSchedulePages(source: string): string[] {
  const pages: string[] = [];
  let start = 0;
  while (start < source.length) {
    let end = Math.min(start + 3000, source.length);
    const last = source.charCodeAt(end - 1);
    if (end < source.length && last >= 0xd800 && last <= 0xdbff) {
      end -= 1;
    }
    pages.push(source.slice(start, end));
    start = end;
  }
  return pages;
}
