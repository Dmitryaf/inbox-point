import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderApp } from '@test/frontend/support/render-app';
import {
  contentFixture,
  mockContent,
} from '@test/frontend/support/mock-content';
import { password } from '@test/frontend/support/mock-session';
import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';

async function editWhileShellRequestIsPending() {
  const api = mockContent();
  const pending = Promise.withResolvers<FakeResponse>();
  const signals: AbortSignal[] = [];
  api.overrides.set('/api/manage/content', (init) => {
    if (init?.signal) {
      signals.push(init.signal);
    }
    return pending.promise;
  });
  const view = renderApp('/setup');
  await screen.findByRole('heading', { name: 'Каналы' });
  await waitFor(() => expect(signals.length).toBeGreaterThan(0));
  api.overrides.set('/api/manage/content', () =>
    Promise.resolve(response(contentFixture())),
  );
  await act(() => view.router.navigate('/manage'));
  const field = await screen.findByLabelText('Название организации');
  fireEvent.change(field, { target: { value: 'Несохранённый документ' } });
  expect(signals.some((signal) => !signal.aborted)).toBe(true);
  return { ...view, api, pending };
}

it('recovers the dirty editor after a previous shell request expires the session', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const { pending, api } = await editWhileShellRequestIsPending();
  await act(async () => {
    pending.resolve(response({}, 401));
    await pending.promise;
  });
  await screen.findByLabelText('Пароль');
  expect(sessionStorage.getItem('inbox-point:content-draft')).toContain(
    'Несохранённый документ',
  );
  await userEvent.type(screen.getByLabelText('Пароль'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await screen.findByText('Несохранённый черновик восстановлен.');
  expect(
    screen.getByLabelText<HTMLInputElement>('Название организации').value,
  ).toBe('Несохранённый документ');
  expect(confirm).not.toHaveBeenCalled();
  expect(api.submissions).toHaveLength(0);
});

it('keeps the input and exit guard when recovery storage fails before shell expiry', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const { pending, router } = await editWhileShellRequestIsPending();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Synthetic full storage', 'QuotaExceededError');
  });
  await act(async () => {
    pending.resolve(response({}, 401));
    await pending.promise;
  });
  await screen.findByText(/Скопируйте изменения с этой страницы перед выходом/);
  expect(
    screen.getByLabelText<HTMLInputElement>('Название организации').value,
  ).toBe('Несохранённый документ');
  expect(screen.queryByLabelText('Пароль')).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Каналы' }));
  expect(router.state.location.pathname).toBe('/manage');
  expect(confirm).toHaveBeenCalled();
});
