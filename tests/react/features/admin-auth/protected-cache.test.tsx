import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';

import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';
import { renderApp } from '@test/react/support/render-app';
import { mockSession, password } from '@test/react/support/mock-session';

it.each([200, 401])(
  'a late old-session response with status %s cannot restore or expire the new session',
  async (status) => {
    const api = mockSession();
    const oldResponse = Promise.withResolvers<FakeResponse>();
    let oldSession = true;
    let reads = 0;
    api.overrides.set('/api/manage/content', () => {
      reads++;
      return oldSession
        ? oldResponse.promise
        : Promise.resolve(
            response({
              content: {
                organizationName: 'Новая организация',
                schedule: '',
                scheduleItems: [],
              },
              version: 'a'.repeat(64),
            }),
          );
    });
    const { queryClient } = renderApp('/setup');
    await screen.findByRole('heading', { name: 'Каналы' });
    await waitFor(() => expect(reads).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    await screen.findByRole('heading', { name: 'Вход в управление' });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    oldSession = false;
    await userEvent.type(screen.getByLabelText('Пароль'), password);
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await screen.findByText('Новая организация');
    await act(async () => {
      oldResponse.resolve(
        status === 200
          ? response({ content: { organizationName: 'Старая организация' } })
          : response({ message: 'old 401' }, 401),
      );
      await oldResponse.promise;
    });
    expect(screen.queryByText('Старая организация')).toBeNull();
    expect(screen.getByText('Новая организация')).toBeDefined();
    expect(
      screen.queryByRole('heading', { name: 'Вход в управление' }),
    ).toBeNull();
  },
);
