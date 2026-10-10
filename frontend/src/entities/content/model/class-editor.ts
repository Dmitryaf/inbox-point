import type { ContentDraft } from './types';
import type { ClassContent } from '@core/application/class-content';
import { defaultApplicationQuestion } from '@core/application/class-content';

export function addClassGroup(
  draft: ContentDraft,
  directionId: string,
): string | undefined {
  if (draft.groups.filter((group) => !group.review).length >= 60) {
    return;
  }
  const id = crypto.randomUUID();
  draft.groups.push({
    id,
    directionId,
    name: '',
    meetings: [''],
    description: '',
    enrollmentOpen: false,
    applicationQuestion: defaultApplicationQuestion,
  });
  return id;
}
export function removeClassGroup(draft: ContentDraft, id: string): void {
  draft.groups = draft.groups.filter((item) => item.id !== id);
  draft.keywords = draft.keywords.filter(
    (item) => item.targetType !== 'group' || item.targetId !== id,
  );
}

export function normalizeClassDraft(content: ClassContent): ClassContent {
  return {
    ...content,
    directions: content.directions?.map((direction) => ({
      ...direction,
      name: direction.name.trim(),
    })),
    groups: content.groups?.map((group) => ({
      ...group,
      name: group.name.trim(),
      meetings: group.meetings.map((time) => time.trim()),
      description: group.description.trim(),
      applicationQuestion: group.applicationQuestion.trim(),
    })),
    keywords: content.keywords?.map((word) => ({
      ...word,
      phrase: word.phrase.trim(),
    })),
  };
}
