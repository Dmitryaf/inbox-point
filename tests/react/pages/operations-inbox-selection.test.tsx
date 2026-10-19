import { act, fireEvent, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';
import { renderApp } from '@test/react/support/render-app';
import { mockOperations } from '@test/react/support/mock-operations';

it.each([200, 401, 503])(
  'does not show or expire on stale selected-conversation response %i',
  async (status) => {
    const api = mockOperations(true);
    renderApp('/ops');
    await screen.findByText('Message A');
    const pending = Promise.withResolvers<FakeResponse>();
    api.overrides.set(
      '/api/ops/inbox/requests/B/messages',
      () => pending.promise,
    );
    fireEvent.click(screen.getByRole('button', { name: /^B VK/ }));
    expect(screen.queryByText('Message A')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^A VK/ }));
    await screen.findByText('Message A');
    await act(async () => {
      pending.resolve(response({ messages: api.state.messages.B }, status));
      await pending.promise;
    });
    expect(screen.queryByText('Message B')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Вход в управление' }),
    ).toBeNull();
  },
);

it('preserves drafts per request, clears previous messages on failure and allows retry', async () => {
  const api = mockOperations(true);
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Draft A' },
  });
  api.overrides.set('/api/ops/inbox/requests/B/messages', () =>
    Promise.resolve(response({}, 503)),
  );
  fireEvent.click(screen.getByRole('button', { name: /^B VK/ }));
  await screen.findByRole('button', { name: 'Повторить загрузку переписки' });
  expect(screen.queryByText('Message A')).toBeNull();
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Отправить' })
      .disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Draft B' },
  });
  api.overrides.set('/api/ops/inbox/requests/B/messages', () =>
    Promise.resolve(response({ messages: api.state.messages.B })),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Повторить загрузку переписки' }),
  );
  await screen.findByText('Message B');
  fireEvent.click(screen.getByRole('button', { name: /^A VK/ }));
  await screen.findByText('Message A');
  expect(screen.getByLabelText<HTMLTextAreaElement>('Ответ').value).toBe(
    'Draft A',
  );
  fireEvent.click(screen.getByRole('button', { name: /^B VK/ }));
  await screen.findByText('Message B');
  expect(screen.getByLabelText<HTMLTextAreaElement>('Ответ').value).toBe(
    'Draft B',
  );
});
