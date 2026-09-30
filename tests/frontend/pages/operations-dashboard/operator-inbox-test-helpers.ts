import { flushPromises, mount } from '@vue/test-utils';
import { vi } from 'vitest';
import * as api from '@frontend/entities/operations/api/operations-api';
import OperatorInbox from '@frontend/widgets/operator-inbox/ui/OperatorInbox.vue';
export const incoming = (id: string) => ({
  messages: [
    {
      id,
      createdAt: '2026-09-01T12:00:00Z',
      direction: 'client_to_operator' as const,
      text: `Message ${id}`,
    },
  ],
});
export function setupInbox() {
  vi.mocked(api.readOperatorInboxRequests).mockResolvedValue({
    requests: ['A', 'B'].map((id) => ({
      id,
      displayName: id,
      channel: 'vk' as const,
      status: 'active',
      createdAt: '2026-09-01T12:00:00Z',
    })),
  });
  vi.mocked(api.readOperatorInboxMessages).mockImplementation((id) =>
    Promise.resolve(incoming(id)),
  );
}
export async function openInbox() {
  const wrapper = mount(OperatorInbox, { props: { onUnauthorized: vi.fn() } });
  await refreshInbox(wrapper);
  await flushPromises();
  return wrapper;
}
export function refreshInbox(wrapper: { vm: unknown }): Promise<string> {
  return (wrapper.vm as { refresh: () => Promise<string> }).refresh();
}
