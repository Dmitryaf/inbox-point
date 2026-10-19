import { describe, expect, it } from 'vitest';

import { channelProblem } from '@frontend/widgets/operations-overview/model/operations-attention';

describe('operations channel attention', () => {
  it('asks the administrator to reconnect an expected channel with missing settings', () => {
    expect(
      channelProblem('Telegram', {
        configured: false,
        running: false,
        source: 'none',
        state: 'configuration_missing',
      }),
    ).toEqual({
      action: 'Откройте «Каналы» и подключите Telegram заново.',
      channel: 'Telegram',
      kind: 'setup',
      name: 'Telegram требует подключения',
      summary:
        'Канал был обязательным для этого экземпляра, но его настройки сейчас недоступны.',
    });
  });
});
