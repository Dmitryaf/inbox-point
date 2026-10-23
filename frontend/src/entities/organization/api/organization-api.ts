import { request } from '@frontend-common/shared/api/http-client';

export async function loadOrganizationName(
  signal: AbortSignal,
): Promise<string> {
  const snapshot = await request<{ content?: { organizationName?: unknown } }>(
    '/api/manage/content',
    { signal },
  );
  return typeof snapshot.content?.organizationName === 'string'
    ? snapshot.content.organizationName
    : '';
}
