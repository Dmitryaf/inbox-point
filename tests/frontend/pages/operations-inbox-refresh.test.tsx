import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { response } from '@test/frontend/support/fake-response';
import { renderApp } from '@test/frontend/support/render-app';
import { mockOperations } from '@test/frontend/support/mock-operations';

it('confirmed reply plus failed read shows one refresh error without requeueing or restoring the sent draft', async () => {
  const api = mockOperations(true);
  api.overrides.set('/api/ops/inbox/requests/A/replies', () => {
    api.overrides.set('/api/ops/inbox/requests', () =>
      Promise.resolve(
        response({ message: 'Не удалось обновить обращения.' }, 503),
      ),
    );
    return Promise.resolve(response({ queued: true }));
  });
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Confirmed reply' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
  await screen.findByText(/Ответ сохранён для отправки/);
  await screen.findByText('Не удалось обновить обращения.');
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByLabelText<HTMLTextAreaElement>('Ответ').value).toBe('');
  api.overrides.set('/api/ops/inbox/requests', () =>
    Promise.resolve(response({ requests: api.state.requests })),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Повторить проверку' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(
    api.commands.filter((item) => item.url.endsWith('/replies')),
  ).toHaveLength(1);
});

it('ownership conflict disables stale web actions even if refreshing the list fails', async () => {
  const api = mockOperations(true);
  api.overrides.set('/api/ops/inbox/requests/A/replies', () => {
    api.overrides.set('/api/ops/inbox/requests', () =>
      Promise.resolve(response({ message: 'Список недоступен.' }, 503)),
    );
    return Promise.resolve(
      response(
        { message: 'Обращение уже перенесено в Telegram. Список обновлён.' },
        409,
      ),
    );
  });
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Reply A' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
  await screen.findByText(
    'Обращение уже перенесено в Telegram. Список обновлён.',
  );
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Отправить' })
      .disabled,
  ).toBe(true);
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Закрыть обращение' })
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
  expect(
    api.commands.filter((item) => item.url.endsWith('/replies')),
  ).toHaveLength(1);
});
