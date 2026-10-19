import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { OperatorRelayIncident } from '@frontend-common/entities/operations/model/types';
import { response } from '@test/frontend/support/fake-response';
import { renderApp } from '@test/react/support/render-app';
import { relayIncident } from '@test/react/support/incident-fixtures';
import { mockOperations } from '@test/react/support/mock-operations';

it.each([
  ['relay_message', 'Сообщение есть в Telegram', 'received'],
  ['mirror_operator_message', 'Сообщение есть в Telegram', 'received'],
  ['open_request', 'Открыть обращение здесь', 'use_web'],
  ['close_request', 'Тема закрыта', 'completed'],
  ['reopen_request', 'Тема осталась закрыта', 'not_completed'],
] as const)(
  'preserves %s resolution and exact action identity',
  async (action, label, resolution) => {
    const api = mockOperations();
    api.state.status.deliveries.incidents = [];
    api.state.status.operatorRelays.incidents = [relayIncident({ action })];
    api.overrides.set(
      '/api/ops/operator-actions/operator%3Arelay-1/resolve',
      () => Promise.resolve(response({ resolved: true })),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/ops');
    fireEvent.click(await screen.findByRole('button', { name: label }));
    await waitFor(() =>
      expect(api.commands).toEqual([
        {
          url: '/api/ops/operator-actions/operator%3Arelay-1/resolve',
          body: { resolution },
        },
      ]),
    );
  },
);

it.each(['failed', 'abandoned'] as const)(
  'explains held replies on %s topic reopening and never resends their text',
  async (status) => {
    const api = mockOperations();
    api.state.status.deliveries.incidents = [];
    api.state.status.operatorRelays.incidents = [
      relayIncident({
        action: 'reopen_request',
        heldReplyCount: 2,
        status,
        reason: 'Ответ сохранён, повторно отправлять его не нужно.',
      }),
    ];
    api.overrides.set(
      '/api/ops/operator-actions/operator%3Arelay-1/resolve',
      () => Promise.resolve(response({ resolved: true })),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/ops');
    expect(
      await screen.findAllByText(
        'Ответ сохранён, повторно отправлять его не нужно.',
      ),
    ).toHaveLength(2);
    expect(screen.getByText(/Сохранено ответов: 2/)).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Открыть обращение здесь' }),
    ).toBeDefined();
    fireEvent.click(
      screen.getByRole('button', { name: 'Повторить открытие темы' }),
    );
    await screen.findByText(/Сохранённый ответ не нужно отправлять ещё раз/);
    expect(api.commands).toEqual([
      {
        url: '/api/ops/operator-actions/operator%3Arelay-1/resolve',
        body: { resolution: 'retry' },
      },
    ]);
  },
);

it('a partial relay cannot be confirmed as wholly received', async () => {
  const api = mockOperations();
  const incident: OperatorRelayIncident = relayIncident({ confirmable: false });
  api.state.status.operatorRelays.incidents = [incident];
  renderApp('/ops');
  await screen.findByText(
    'Не все сообщения появились в Telegram. Откройте обращение здесь.',
  );
  expect(
    screen.queryByRole('button', { name: 'Сообщение есть в Telegram' }),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Открыть обращение здесь' }),
  ).toBeDefined();
  expect(api.commands).toHaveLength(0);
});
