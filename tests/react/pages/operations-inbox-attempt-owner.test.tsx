import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { response } from '@test/frontend/support/fake-response';
import { renderApp } from '@test/react/support/render-app';
import { mockOperations } from '@test/react/support/mock-operations';

it('reply B cannot discard the uncertain attempt key owned by A', async () => {
  const api = mockOperations(true);
  api.overrides.set('/api/ops/inbox/requests/A/replies', () =>
    Promise.resolve(response({ message: 'Подтверждение потеряно.' }, 503)),
  );
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Uncertain A' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
  await screen.findByText('Подтверждение потеряно.');
  fireEvent.click(screen.getByRole('button', { name: /^B VK/ }));
  await screen.findByText('Message B');
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Reply B' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
  await screen.findByText('Reply B');
  fireEvent.click(screen.getByRole('button', { name: /^A VK/ }));
  await screen.findByText('Message A');
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Отправить' })
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
  const attempts = () =>
    api.commands.filter(
      (item) => item.url === '/api/ops/inbox/requests/A/replies',
    );
  await waitFor(() => expect(attempts()).toHaveLength(2));
  expect(attempts()[1]!.body).toEqual(attempts()[0]!.body);
});
