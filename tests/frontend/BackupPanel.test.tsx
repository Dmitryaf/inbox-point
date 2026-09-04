// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BackupPanel } from '@legacy/ServiceTools';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('reports a backup only after confirmed creation and permits retry after failure', async () => {
  const creating = Promise.withResolvers<Response>();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      json({ message: 'Не удалось проверить копию.' }, 500),
    )
    .mockImplementationOnce(() => creating.promise);
  vi.stubGlobal('fetch', fetchMock);
  render(<BackupPanel />);
  const button = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Создать резервную копию',
  });
  fireEvent.click(button);
  await screen.findByText('Не удалось проверить копию.');
  fireEvent.click(button);
  await screen.findByText('Создаём и проверяем копию…');
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  creating.resolve(json({ fileName: 'synthetic-backup.sqlite' }));
  await screen.findByText('Резервная копия создана: synthetic-backup.sqlite.');
  expect(button.disabled).toBe(false);
});
