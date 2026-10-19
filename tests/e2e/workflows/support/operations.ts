import type { Page } from '@playwright/test';
export interface OperationsEvidence {
  ids: string[];
  requests: { id: string; status: string; operatorTopicId: string }[];
  pending: {
    id: string;
    requestId: string;
    conversationId: string;
    text: string;
    idempotencyKey: string;
  }[];
  failed: { id: string; outcomeUnknown: boolean }[];
  control?: {
    channels: { telegram: { mode: string }; vk: { mode: string } };
    delivery: { mode: string };
  };
}
export async function operationsEvidence(
  page: Page,
): Promise<OperationsEvidence> {
  return (await (
    await page.request.get('/api/test/state')
  ).json()) as OperationsEvidence;
}
