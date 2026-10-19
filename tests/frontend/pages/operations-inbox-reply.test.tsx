import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';
import { renderApp } from '@test/frontend/support/render-app';
import { mockOperations } from '@test/frontend/support/mock-operations';

it.each([false, true])(
  'pending reply clears only its submitted snapshot with new input=%s and a different selection',
  async (newInput) => {
    const api = mockOperations(true);
    const pending = Promise.withResolvers<FakeResponse>();
    api.overrides.set(
      '/api/ops/inbox/requests/A/replies',
      () => pending.promise,
    );
    renderApp('/ops');
    await screen.findByText('Message A');
    fireEvent.change(screen.getByLabelText('Ответ'), {
      target: { value: 'Reply A' },
    });
    const button = screen.getByRole('button', { name: 'Отправить' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() =>
      expect(
        api.commands.filter((item) => item.url.endsWith('/replies')),
      ).toHaveLength(1),
    );
    if (newInput) {
      fireEvent.change(screen.getByLabelText('Ответ'), {
        target: { value: 'Later A' },
      });
    }
    fireEvent.click(screen.getByRole('button', { name: /^B VK/ }));
    await screen.findByText('Message B');
    fireEvent.change(screen.getByLabelText('Ответ'), {
      target: { value: 'Draft B' },
    });
    await act(async () => {
      pending.resolve(response({ queued: true }));
      await pending.promise;
    });
    await screen.findByText(/Ответ сохранён для отправки/);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Ответ').value).toBe(
      'Draft B',
    );
    fireEvent.click(screen.getByRole('button', { name: /^A VK/ }));
    await screen.findByText('Message A');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Ответ').value).toBe(
      newInput ? 'Later A' : '',
    );
    expect(
      api.commands.find((item) => item.url.endsWith('/replies')),
    ).toMatchObject({
      url: '/api/ops/inbox/requests/A/replies',
      body: { text: 'Reply A' },
    });
  },
);

it('a confirmed reply is queued, reread and closed through the same request without erasing another draft', async () => {
  mockOperations(true);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Мы поможем' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
  await screen.findByText('Мы поможем');
  expect(screen.getByText('Готовится к отправке')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть обращение' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /^A VK/ })).toBeNull(),
  );
  await screen.findByText('Message B');
});
