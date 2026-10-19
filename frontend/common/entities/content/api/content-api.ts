import type {
  ContentChange,
  ContentDraft,
  ContentSnapshot,
} from '@frontend-common/entities/content/model/types';
import { HttpError, request } from '@frontend-common/shared/api/http-client';

export async function loadContent(
  signal?: AbortSignal,
): Promise<ContentSnapshot> {
  return requireStructuredScheduleApi(
    await request<ContentSnapshot>(
      '/api/manage/content',
      signal ? { signal } : {},
    ),
  );
}
export async function loadContentHistory(
  signal?: AbortSignal,
): Promise<ContentChange[]> {
  const result = await request<{ history: ContentChange[] }>(
    '/api/manage/content/history',
    signal ? { signal } : {},
  );
  return result.history;
}
export async function loadContentRevision(
  revision: number,
  signal?: AbortSignal,
): Promise<ContentSnapshot> {
  return requireStructuredScheduleApi(
    await request<ContentSnapshot>(
      `/api/manage/content/history/${revision}`,
      signal ? { signal } : {},
    ),
  );
}
export async function saveContent(
  content: ContentDraft,
  version: string,
): Promise<ContentSnapshot> {
  const { legacySchedule, schedule, ...sections } = content;
  return requireStructuredScheduleApi(
    await request<ContentSnapshot>('/api/manage/content', {
      body: JSON.stringify({
        content: {
          ...sections,
          schedule: legacySchedule,
          scheduleItems: schedule,
        },
        version,
      }),
      method: 'POST',
    }),
  );
}
export async function restoreContent(
  revision: number,
  version: string,
): Promise<ContentSnapshot> {
  return requireStructuredScheduleApi(
    await request<ContentSnapshot>('/api/manage/content/restore', {
      body: JSON.stringify({ revision, version }),
      method: 'POST',
    }),
  );
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
