import * as api from '@frontend-common/entities/content/api/content-api';
import type {
  ContentDraft,
  ContentSnapshot,
} from '@frontend-common/entities/content/model/types';
import { setOrganizationName } from '@frontend/entities/content/model/organization-name';

export const loadContentHistory = api.loadContentHistory;
export const loadContentRevision = api.loadContentRevision;
export async function loadContent(): Promise<ContentSnapshot> {
  return updateOrganization(await api.loadContent());
}
export async function saveContent(
  content: ContentDraft,
  version: string,
): Promise<ContentSnapshot> {
  return updateOrganization(await api.saveContent(content, version));
}
export async function restoreContent(
  revision: number,
  version: string,
): Promise<ContentSnapshot> {
  return updateOrganization(await api.restoreContent(revision, version));
}
function updateOrganization(snapshot: ContentSnapshot): ContentSnapshot {
  setOrganizationName(snapshot.content.organizationName);
  return snapshot;
}
