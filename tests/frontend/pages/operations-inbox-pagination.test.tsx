import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { response } from '@test/frontend/support/fake-response';
import { renderApp } from '@test/frontend/support/render-app';
import { mockOperations } from '@test/frontend/support/mock-operations';

it('loads older requests without duplicates and keeps their selection and draft on refresh', async () => {
  const api = mockOperations(true);
  api.state.requests[1]!.createdAt = '2026-08-31T12:00:00Z';
  api.overrides.set('/api/ops/inbox/requests', () =>
    Promise.resolve(
      response({ requests: [api.state.requests[0]], nextCursor: 'older' }),
    ),
  );
  api.overrides.set('/api/ops/inbox/requests?cursor=older', () =>
    Promise.resolve(response({ requests: api.state.requests })),
  );
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.click(
    screen.getByRole('button', { name: 'Загрузить ещё обращения' }),
  );
  fireEvent.click(await screen.findByRole('button', { name: /^B VK/ }));
  await screen.findByText('Message B');
  expect(screen.getAllByRole('button', { name: /^A VK/ })).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Draft for older B' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: /^B VK/ })
        .getAttribute('aria-pressed'),
    ).toBe('true'),
  );
  expect(screen.getByLabelText<HTMLTextAreaElement>('Ответ').value).toBe(
    'Draft for older B',
  );
  expect(screen.getAllByText('Message B')).toHaveLength(1);
});

it('retains older messages and the reply draft when new messages arrive during pagination', async () => {
  const api = mockOperations(true);
  const oldest = {
    ...api.state.messages.A![0]!,
    id: 'old',
    text: 'Oldest message',
  };
  api.overrides.set('/api/ops/inbox/requests/A/messages', () =>
    Promise.resolve(
      response({
        messages: api.state.messages.A,
        nextCursor: 'older-messages',
      }),
    ),
  );
  api.overrides.set(
    '/api/ops/inbox/requests/A/messages?cursor=older-messages',
    () =>
      Promise.resolve(
        response({ messages: [oldest, api.state.messages.A![0]] }),
      ),
  );
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Keep my draft' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Загрузить предыдущие сообщения' }),
  );
  await screen.findByText('Oldest message');
  api.state.messages.A!.push({
    ...oldest,
    id: 'new',
    text: 'New message',
    createdAt: '2026-09-01T12:02:00Z',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
  await screen.findByText('New message');
  expect(screen.getAllByText('Message A')).toHaveLength(1);
  expect(screen.getAllByText('Oldest message')).toHaveLength(1);
  expect(screen.getByLabelText<HTMLTextAreaElement>('Ответ').value).toBe(
    'Keep my draft',
  );
});
