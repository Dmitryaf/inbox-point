import type {
  ContentChange,
  ContentDraft,
  ContentSnapshot,
} from '@frontend/entities/content/model/types';
import { request } from '@frontend/shared/api/http-client';

export function loadContent(): Promise<ContentSnapshot> {
  return request('/api/manage/content');
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
  return request('/api/manage/content', {
    body: JSON.stringify({ content, version }),
    method: 'POST',
  });
}

export function restoreContent(
  revision: number,
  version: string,
): Promise<ContentSnapshot> {
  return request('/api/manage/content/restore', {
    body: JSON.stringify({ revision, version }),
    method: 'POST',
  });
}
