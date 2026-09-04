import type {
  ContentChange,
  ContentDraft,
} from '@manage/entities/content/model/types';
import { request } from '@frontend/shared/api/http-client';

export function loadContent(): Promise<Partial<ContentDraft>> {
  return request('/api/manage/content');
}

export async function loadContentHistory(): Promise<ContentChange[]> {
  const result = await request<{ history: ContentChange[] }>(
    '/api/manage/content/history',
  );
  return result.history;
}

export function saveContent(content: ContentDraft): Promise<unknown> {
  return request('/api/manage/content', {
    body: JSON.stringify(content),
    method: 'POST',
  });
}

export function restoreContent(revision: number): Promise<unknown> {
  return request('/api/manage/content/restore', {
    body: JSON.stringify({ revision }),
    method: 'POST',
  });
}
