import type {
  ContentChange,
  ContentDraft,
  ContentSnapshot,
} from '@frontend/entities/content/model/types';
import { HttpError, request } from '@frontend/shared/api/http-client';

export async function loadContent(): Promise<ContentSnapshot> {
  return requireStructuredScheduleApi(
    await request<ContentSnapshot>('/api/manage/content'),
  );
}

export async function loadContentHistory(): Promise<ContentChange[]> {
  const result = await request<{ history: ContentChange[] }>(
    '/api/manage/content/history',
  );
  return result.history;
}

export function saveContent(
  content: ContentDraft,
  version: string,
): Promise<ContentSnapshot> {
  const { legacySchedule, schedule, ...sections } = content;
  return request<ContentSnapshot>('/api/manage/content', {
    body: JSON.stringify({
      content: {
        ...sections,
        schedule: legacySchedule,
        scheduleItems: schedule,
      },
      version,
    }),
    method: 'POST',
  }).then(requireStructuredScheduleApi);
}

export function restoreContent(
  revision: number,
  version: string,
): Promise<ContentSnapshot> {
  return request<ContentSnapshot>('/api/manage/content/restore', {
    body: JSON.stringify({ revision, version }),
    method: 'POST',
  }).then(requireStructuredScheduleApi);
}

function requireStructuredScheduleApi(
  snapshot: ContentSnapshot,
): ContentSnapshot {
  if (!Array.isArray(snapshot.content.scheduleItems)) {
    throw new HttpError(
      409,
      'Сервер и страница используют разные версии. Обновите страницу.',
    );
  }
  return snapshot;
}
