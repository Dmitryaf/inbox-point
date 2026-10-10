import { createHash } from 'node:crypto';
import type { ClientInformationContent } from '@/core/application/client-information.js';
import { copyClientInformationContent } from '@/core/application/client-information.js';
import {
  normalizeKeyword,
  type ClassGroup,
} from '@/core/application/class-content.js';

const schoolTitles = new Map([
  ['Бачата парная (начинающие)', ['Бачата парная', 'Начинающие']],
  ['Бачата парная (продолжающая)', ['Бачата парная', 'Продолжающие']],
  ['Сальса парная (начинающая)', ['Сальса парная', 'Начинающие']],
  ['Сальса парная (продолжающие)', ['Сальса парная', 'Продолжающие']],
]);

export function migrateSchedule(
  content: ClientInformationContent,
): ClientInformationContent {
  if (!content.schedule?.length && !content.legacySchedule) {
    return copyClientInformationContent(content);
  }
  const result = copyClientInformationContent(content);
  const directions = [...(result.directions ?? [])];
  const groups = [...(result.groups ?? [])];
  const originalGroupIds = new Set(groups.map((group) => group.id));
  const usedIds = new Set([...directions, ...groups].map((item) => item.id));
  const allocateId = (seed: string): string => {
    let attempt = 0;
    let id: string;
    do {
      id =
        'import-' +
        createHash('sha256')
          .update(`${seed}:${attempt++}`)
          .digest('hex')
          .slice(0, 28);
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };
  const review = (source: string, index: number): void => {
    groups.push({
      id: allocateId(`review:${index}:${source}`),
      directionId: '',
      name: '',
      meetings: [],
      description: '',
      applicationQuestion: '',
      enrollmentOpen: false,
      review: { source },
    });
  };
  for (const [index, item] of (result.schedule ?? []).entries()) {
    const source = [item.title, item.dayTime, item.description]
      .filter((value) => value !== undefined)
      .join('\n');
    const names = schoolTitles.get(item.title);
    if (!names || !item.dayTime.trim()) {
      review(source, index);
      continue;
    }
    const [directionName, groupName] = names as [string, string];
    let direction = directions.find(
      (candidate) =>
        normalizeKeyword(candidate.name) === normalizeKeyword(directionName),
    );
    if (!direction) {
      if (directions.length >= 20) {
        review(source, index);
        continue;
      }
      direction = {
        id: allocateId(`direction:${directionName}`),
        name: directionName,
      };
      directions.push(direction);
    }
    const existing = groups.find(
      (group) =>
        !group.review &&
        group.directionId === direction.id &&
        normalizeKeyword(group.name) === normalizeKeyword(groupName),
    );
    if (existing) {
      // Existing groups belong to teachers: only consume an exact duplicate.
      if (
        existing.meetings.includes(item.dayTime) &&
        existing.description === (item.description ?? '')
      ) {
        continue;
      }
      if (
        !originalGroupIds.has(existing.id) &&
        existing.description === (item.description ?? '') &&
        existing.meetings.length < 7
      ) {
        existing.meetings.push(item.dayTime);
      } else {
        review(source, index);
      }
      continue;
    }
    if (groups.filter((group) => !group.review).length >= 60) {
      review(source, index);
      continue;
    }
    groups.push({
      id: allocateId(`group:${directionName}:${groupName}`),
      directionId: direction.id,
      name: groupName,
      meetings: [item.dayTime],
      description: item.description ?? '',
      enrollmentOpen: false,
      applicationQuestion: '',
    } satisfies ClassGroup);
  }
  if (result.legacySchedule) {
    review(result.legacySchedule, -1);
  }
  delete result.schedule;
  delete result.legacySchedule;
  return { ...result, directions, groups };
}
