import { act, fireEvent, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { renderApp } from '@test/frontend/support/render-app';
import { mockContent } from '@test/frontend/support/mock-content';
import { response } from '@test/frontend/support/fake-response';

async function dirtyEditor(forward = false) {
  const api = mockContent();
  const view = renderApp('/setup');
  await screen.findByRole('heading', { name: 'Каналы' });
  await act(() => view.router.navigate('/manage'));
  if (forward) {
    await act(() => view.router.navigate('/setup'));
    await act(() => view.router.navigate(-1));
  }
  await screen.findByLabelText('Название организации');
  fireEvent.change(screen.getByLabelText('Название организации'), {
    target: { value: 'Черновик' },
  });
  return { ...view, api };
}
it.each(['link', 'back', 'forward'])(
  'blocks and permits dirty navigation through %s',
  async (action) => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { router } = await dirtyEditor(action === 'forward');
    const leave = async () => {
      if (action === 'back') {
        await act(() => router.navigate(-1));
      } else if (action === 'forward') {
        await act(() => router.navigate(1));
      } else {
        fireEvent.click(screen.getByRole('link', { name: 'Каналы' }));
      }
    };
    await leave();
    expect(router.state.location.pathname).toBe('/manage');
    expect(
      screen.getByLabelText<HTMLInputElement>('Название организации').value,
    ).toBe('Черновик');
    expect(confirm).toHaveBeenLastCalledWith('Уйти без сохранения изменений?');
    confirm.mockReturnValue(true);
    await leave();
    await screen.findByRole('heading', { name: 'Каналы' });
    expect(router.state.location.pathname).toBe('/setup');
    expect(sessionStorage.getItem('inbox-point:content-draft')).toBeNull();
  },
);
it.each(['Выйти', 'Выйти на всех устройствах'])(
  'confirms dirty %s before sending any command',
  async (label) => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { api } = await dirtyEditor();
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(api.commands).toHaveLength(0);
    expect(confirm).toHaveBeenLastCalledWith('Выйти без сохранения изменений?');
    if (label !== 'Выйти') {
      confirm.mockReturnValueOnce(true).mockReturnValueOnce(false);
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(api.commands).toHaveLength(0);
    }
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: label }));
    await screen.findByLabelText('Пароль');
    expect(api.commands).toHaveLength(1);
  },
);
it('prevents beforeunload only while dirty and removes listeners on unmount', async () => {
  const { unmount } = await dirtyEditor();
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  unmount();
  const after = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});

it('keeps the dirty guard after a confirmed logout fails', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const { api } = await dirtyEditor();
  api.overrides.set('/api/admin/logout', () =>
    Promise.resolve(response({ message: 'Не удалось выйти.' }, 503)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
  await screen.findByText('Не удалось выйти.');
  confirm.mockReturnValue(false);
  fireEvent.click(screen.getByRole('link', { name: 'Каналы' }));
  expect(
    screen.getByLabelText<HTMLInputElement>('Название организации').value,
  ).toBe('Черновик');
  expect(confirm).toHaveBeenLastCalledWith('Уйти без сохранения изменений?');
});
