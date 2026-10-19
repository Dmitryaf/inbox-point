import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { response } from '@test/frontend/support/fake-response';
import { renderApp } from '@test/react/support/render-app';
import { mockOperations } from '@test/react/support/mock-operations';

it('reuses the failed reply key for the same recipient/text and changes it for a new attempt', async () => {
  const api = mockOperations(true);
  api.overrides.set('/api/ops/inbox/requests/A/replies', () =>
    Promise.resolve(response({ message: 'Повторите действие.' }, 503)),
  );
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: ' Reply A ' },
  });
  const submissions = () =>
    api.commands.filter((item) => item.url.endsWith('/replies'));
  for (let index = 0; index < 2; index++) {
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await screen.findByRole('alert');
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'Отправить' })
          .disabled,
      ).toBe(false),
    );
  }
  expect(submissions()).toHaveLength(2);
  expect(submissions()[1]!.body).toEqual(submissions()[0]!.body);
  expect(submissions()[0]!.body).toMatchObject({ text: 'Reply A' });
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Different reply' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
  await waitFor(() => expect(submissions()).toHaveLength(3));
  expect(submissions()[2]!.body).not.toEqual(submissions()[1]!.body);
});

it('ownership conflict refreshes the inbox and disables the obsolete web command', async () => {
  const api = mockOperations(true);
  api.overrides.set('/api/ops/inbox/requests/A/replies', () => {
    api.state.requests = [];
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
  expect(screen.queryByRole('button', { name: 'Отправить' })).toBeNull();
  expect(
    api.commands.filter((item) => item.url.endsWith('/replies')),
  ).toHaveLength(1);
});
