import type { SetupStatus } from '@frontend-common/entities/setup/model/types';
import { response } from '@test/frontend/support/fake-response';
import { mockSession } from './mock-session';

export const token = 'synthetic-channel-access-token';
export const none = {
  connected: false,
  locked: false,
  source: 'none',
} as const;
export const local = {
  connected: true,
  locked: true,
  source: 'local',
} as const;
export function mockSetup(initial: SetupStatus = { ...none, vk: none }) {
  const api = mockSession();
  let status = structuredClone(initial);
  const effects: string[] = [];
  api.overrides.set('/api/setup/status', () =>
    Promise.resolve(response(status)),
  );
  api.overrides.set('/api/setup/telegram/discover', () =>
    Promise.resolve(
      response({
        chats: [
          { id: -1001, title: 'Группа сотрудников', isForum: true },
          { id: -1002, title: 'Без тем', isForum: false },
        ],
      }),
    ),
  );
  for (const channel of ['telegram', 'vk'] as const) {
    api.overrides.set(`/api/setup/${channel}/connect`, () => {
      effects.push(`${channel}:connect`);
      status =
        channel === 'telegram'
          ? { ...status, ...local }
          : { ...status, vk: local };
      return Promise.resolve(response({ connected: true }));
    });
    api.overrides.set(`/api/setup/${channel}`, () => {
      effects.push(`${channel}:disconnect`);
      status =
        channel === 'telegram'
          ? { ...status, ...none }
          : { ...status, vk: none };
      return Promise.resolve(response({ connected: false }));
    });
  }
  return { ...api, effects };
}
