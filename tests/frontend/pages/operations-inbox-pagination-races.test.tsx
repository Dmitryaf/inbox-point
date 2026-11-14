import { act, fireEvent, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';
import { renderApp } from '@test/frontend/support/render-app';
import { mockOperations } from '@test/frontend/support/mock-operations';

it('refreshes the expanded history when an older page is still loading', async () => {
  const api = mockOperations(true);
  const older = Promise.withResolvers<FakeResponse>();
  const oldest = {
    ...api.state.messages.A![0]!,
    id: 'old',
    text: 'Older history',
  };
  api.overrides.set('/api/ops/inbox/requests/A/messages', () =>
    Promise.resolve(
      response({ messages: [...api.state.messages.A!], nextCursor: 'older' }),
    ),
  );
  api.overrides.set(
    '/api/ops/inbox/requests/A/messages?cursor=older',
    () => older.promise,
  );
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.click(
    screen.getByRole('button', { name: 'Загрузить предыдущие сообщения' }),
  );
  api.state.messages.A!.push({
    ...oldest,
    id: 'new',
    text: 'Incoming during loading',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    older.resolve(response({ messages: [oldest] }));
    await older.promise;
  });
  await screen.findByText('Incoming during loading');
  expect(screen.getAllByText('Older history')).toHaveLength(1);
  expect(screen.getAllByText('Message A')).toHaveLength(1);
});

it('ignores an old history page and its 401 after selecting another conversation', async () => {
  const api = mockOperations(true);
  const older = Promise.withResolvers<FakeResponse>();
  api.overrides.set('/api/ops/inbox/requests/A/messages', () =>
    Promise.resolve(
      response({ messages: api.state.messages.A, nextCursor: 'older' }),
    ),
  );
  api.overrides.set(
    '/api/ops/inbox/requests/A/messages?cursor=older',
    () => older.promise,
  );
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.click(
    screen.getByRole('button', { name: 'Загрузить предыдущие сообщения' }),
  );
  fireEvent.click(screen.getByRole('button', { name: /^B VK/ }));
  await screen.findByText('Message B');
  await act(async () => {
    older.resolve(response({}, 401));
    await older.promise;
  });
  expect(screen.queryByLabelText('Пароль')).toBeNull();
  expect(screen.getAllByText('Message B')).toHaveLength(1);
  expect(screen.queryByRole('alert')).toBeNull();
});
