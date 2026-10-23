import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { response } from '@test/frontend/support/fake-response';
import { mockOperations } from '@test/frontend/support/mock-operations';
import { renderApp } from '@test/frontend/support/render-app';

it('confirms delivery retry, separates command success from failed refresh and retries only reads', async () => {
  const api = mockOperations();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderApp('/ops');
  const button = await screen.findByRole('button', {
    name: 'Повторить отправку',
  });
  fireEvent.click(button);
  expect(api.commands).toHaveLength(0);
  confirm.mockReturnValue(true);
  api.overrides.set('/api/ops/status', () =>
    Promise.resolve(
      response({ message: 'Не удалось обновить состояние.' }, 503),
    ),
  );
  fireEvent.click(button);
  fireEvent.click(button);
  await screen.findByText('Повторная отправка началась.');
  await screen.findByText('Не удалось обновить состояние.');
  expect(api.commands).toEqual([
    { url: '/api/ops/deliveries/delivery-1/retry', body: {} },
  ]);
  api.overrides.set('/api/ops/status', () =>
    Promise.resolve(response(api.state.status)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Повторить проверку' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(api.commands).toHaveLength(1);
});

it.each(['received', 'not_received'] as const)(
  'unknown delivery requires explicit %s resolution, not a blind retry',
  async (resolution) => {
    const api = mockOperations();
    api.state.status.deliveries.incidents = [
      {
        ...api.state.status.deliveries.incidents[0]!,
        id: 'delivery:unknown',
        outcomeUnknown: true,
        retryAllowed: false,
      },
    ];
    api.overrides.set('/api/ops/deliveries/delivery%3Aunknown/resolve', () =>
      Promise.resolve(response({ resolved: true })),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/ops');
    await screen.findByText('Доставку в Telegram нужно проверить');
    expect(
      screen.queryByRole('button', { name: 'Повторить отправку' }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name:
          resolution === 'received'
            ? 'Сообщение получено'
            : 'Не получено — повторить',
      }),
    );
    await waitFor(() =>
      expect(api.commands).toEqual([
        {
          url: '/api/ops/deliveries/delivery%3Aunknown/resolve',
          body: { resolution },
        },
      ]),
    );
  },
);

it.each(['telegram', 'vk', 'delivery'] as const)(
  'pauses and resumes %s with exact endpoint and confirmation',
  async (target) => {
    const api = mockOperations();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/ops');
    await screen.findByText('Нужно проверить');
    fireEvent.click(screen.getByText('Управление сообщениями'));
    await screen.findAllByRole('button', { name: 'Приостановить' });
    fireEvent.click(
      target === 'delivery'
        ? screen.getByRole('button', { name: 'Приостановить ответы' })
        : screen.getAllByRole('button', { name: 'Приостановить' })[
            target === 'telegram' ? 0 : 1
          ]!,
    );
    await waitFor(() =>
      expect(api.commands).toContainEqual({
        url: `/api/ops/service-control/${target}/pause`,
        body: {},
      }),
    );
    const resume = await screen.findByRole('button', {
      name: target === 'delivery' ? 'Возобновить ответы' : 'Возобновить',
    });
    fireEvent.click(resume);
    await waitFor(() =>
      expect(api.commands).toContainEqual({
        url: `/api/ops/service-control/${target}/resume`,
        body: {},
      }),
    );
  },
);
