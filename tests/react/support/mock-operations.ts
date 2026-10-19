import type {
  OperatorInboxMessage,
  OperatorInboxRequest,
} from '@frontend-common/entities/operations/model/types';
import type { ServiceControlState } from '@frontend-common/entities/service-control/model/types';
import { attentionOperationsStatus } from '@test/frontend/pages/operations-dashboard/operations-status-fixture';
import { response } from '@test/frontend/support/fake-response';
import { mockSession } from './mock-session';

export function mockOperations(withInbox = false) {
  const api = mockSession();
  const state = {
    status: attentionOperationsStatus(),
    requests: (withInbox ? ['A', 'B'] : []).map((id) => ({
      id,
      displayName: id,
      channel: 'vk',
      status: 'active',
      createdAt: '2026-09-01T12:00:00Z',
    })) as OperatorInboxRequest[],
    messages: Object.fromEntries(
      ['A', 'B'].map((id) => [
        id,
        [
          {
            id,
            createdAt: '2026-09-01T12:00:00Z',
            direction: 'client_to_operator',
            text: `Message ${id}`,
          },
        ],
      ]),
    ) as Record<string, OperatorInboxMessage[]>,
    control: {
      channels: { telegram: { mode: 'active' }, vk: { mode: 'active' } },
      delivery: { mode: 'active' },
    } as ServiceControlState,
  };
  api.overrides.set('/api/ops/status', () =>
    Promise.resolve(response(state.status)),
  );
  api.overrides.set('/api/ops/service-control', () =>
    Promise.resolve(response(state.control)),
  );
  api.overrides.set('/api/ops/inbox/requests', () =>
    Promise.resolve(response({ requests: [...state.requests] })),
  );
  for (const id of ['A', 'B']) {
    api.overrides.set(`/api/ops/inbox/requests/${id}/messages`, () =>
      Promise.resolve(response({ messages: [...state.messages[id]!] })),
    );
    api.overrides.set(`/api/ops/inbox/requests/${id}/replies`, (init) => {
      if (typeof init?.body !== 'string') {
        throw new Error('Expected JSON reply body');
      }
      const body = JSON.parse(init.body) as {
        text: string;
        idempotencyKey: string;
      };
      if (
        !state.messages[id]!.some(
          (message) => message.id === body.idempotencyKey,
        )
      ) {
        state.messages[id]!.push({
          id: body.idempotencyKey,
          createdAt: '2026-09-01T12:01:00Z',
          direction: 'operator_to_client',
          text: body.text,
          deliveryStatus: 'pending',
        });
      }
      return Promise.resolve(response({ queued: true }));
    });
    api.overrides.set(`/api/ops/inbox/requests/${id}/close`, () => {
      state.requests = state.requests.filter((request) => request.id !== id);
      return Promise.resolve(response({ closed: true }));
    });
  }
  for (const target of ['telegram', 'vk', 'delivery'] as const) {
    for (const command of ['pause', 'resume'] as const) {
      api.overrides.set(`/api/ops/service-control/${target}/${command}`, () => {
        const value = {
          mode: command === 'pause' ? ('paused' as const) : ('active' as const),
        };
        if (target === 'delivery') {
          state.control.delivery = value;
          state.status.outbound = value;
        } else {
          state.control.channels[target] = value;
          state.status.intake[target] = value;
        }
        return Promise.resolve(response(state.control));
      });
    }
  }
  api.overrides.set('/api/ops/deliveries/delivery-1/retry', () =>
    Promise.resolve(response({ queued: true })),
  );
  return { ...api, state };
}
