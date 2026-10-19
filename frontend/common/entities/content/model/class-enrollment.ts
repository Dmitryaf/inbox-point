import {
  classContentIssue,
  normalizeKeyword,
  type ClassContent,
  type ClassGroup,
} from '@core/application/class-content';
import { normalizeClassDraft } from './class-editor';

export function duplicateClassGroup(
  groups: readonly ClassGroup[],
  group: ClassGroup,
): ClassGroup | undefined {
  return groups.find(
    (item) =>
      item.id !== group.id &&
      !item.review &&
      item.directionId === group.directionId &&
      normalizeKeyword(item.name) === normalizeKeyword(group.name),
  );
}

export function classEnrollmentIssue(
  content: ClassContent,
  group: ClassGroup,
): string | undefined {
  const direction = content.directions?.find(
    (item) => item.id === group.directionId,
  );
  if (!direction) {
    return 'Выберите направление для этой группы.';
  }
  if (!group.name.trim()) {
    return 'Укажите название группы.';
  }
  if (duplicateClassGroup(content.groups ?? [], group)) {
    return 'В этом направлении уже есть группа с таким названием. Укажите другое название или удалите лишнюю группу.';
  }
  if (!group.meetings.length || group.meetings.some((time) => !time.trim())) {
    return 'Укажите дни и время занятий.';
  }
  if (
    group.review &&
    (content.groups ?? []).filter((item) => !item.review).length >= 60
  ) {
    return 'Можно добавить до 60 групп. Удалите лишнюю группу.';
  }
  const candidate = { ...group, enrollmentOpen: true };
  delete candidate.review;
  return classContentIssue(
    normalizeClassDraft({ directions: [direction], groups: [candidate] }),
    [],
  );
}
