import type { ContentDraft } from './types';
import { defaultApplicationQuestion } from '@core/application/class-content';

export function addClassGroup(draft: ContentDraft, directionId: string): void {
  if (draft.groups.length >= 60) {
    return;
  }
  draft.groups.push({
    id: crypto.randomUUID(),
    directionId,
    name: '',
    meetings: [''],
    description: '',
    enrollmentOpen: false,
    applicationQuestion: defaultApplicationQuestion,
  });
}
export function removeClassGroup(draft: ContentDraft, id: string): void {
  draft.groups = draft.groups.filter((item) => item.id !== id);
  draft.keywords = draft.keywords.filter(
    (item) => item.targetType !== 'group' || item.targetId !== id,
  );
}
export function transferScheduleItem(
  draft: ContentDraft,
  index: number,
  directionId: string,
): boolean {
  const item = draft.schedule[index];
  if (
    !item?.title.trim() ||
    !item.dayTime.trim() ||
    item.title.trim().length > 80 ||
    /[/:\r\n]/u.test(item.title) ||
    draft.groups.length >= 60 ||
    !draft.directions.some((direction) => direction.id === directionId)
  ) {
    return false;
  }
  if (
    draft.groups.some(
      (group) =>
        group.directionId === directionId &&
        group.name.toLocaleLowerCase('ru') ===
          item.title.trim().toLocaleLowerCase('ru'),
    )
  ) {
    return false;
  }
  draft.groups.push({
    id: crypto.randomUUID(),
    directionId,
    name: item.title.trim(),
    meetings: [item.dayTime.trim()],
    description: item.description?.trim() ?? '',
    enrollmentOpen: false,
    applicationQuestion: defaultApplicationQuestion,
  });
  draft.schedule.splice(index, 1);
  return true;
}
