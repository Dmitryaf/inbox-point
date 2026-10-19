import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';
import { analyticsReport } from '@test/frontend/pages/analytics/analytics-fixture';
import { mockSession } from '@test/react/support/mock-session';
import { renderApp } from '@test/react/support/render-app';

it('preserves original report, filters, channel columns, chart and precise daily values', async () => {
  const api = mockSession();
  const report = analyticsReport();
  for (const period of ['7d', '30d', '90d']) {
    for (const channel of ['all', 'telegram', 'vk'] as const) {
      api.overrides.set(
        `/api/analytics?period=${period}&channel=${channel}`,
        () => Promise.resolve(response({ ...report, channel })),
      );
    }
  }
  renderApp('/analytics');
  await screen.findByRole('article', { name: 'Отчёт об использовании' });
  expect(screen.getByText('Записаться на пробное')).toBeDefined();
  expect(screen.queryByText('custom:synthetic-id')).toBeNull();
  expect(screen.getByLabelText('Использование каналов').textContent).toContain(
    'Обращения: 8',
  );
  for (const name of [
    '7 дней',
    '90 дней',
    '30 дней',
    'Telegram',
    'VK',
    'Все каналы',
  ]) {
    fireEvent.click(screen.getByRole('button', { name }));
    await screen.findByRole('article');
    expect(
      screen.getByRole('button', { name }).getAttribute('aria-pressed'),
    ).toBe('true');
    if (name === 'VK') {
      expect(
        screen.queryByRole('columnheader', { name: 'Telegram' }),
      ).toBeNull();
    }
  }
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
    'Точные значения',
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Показать значения по дням' }),
  );
  expect(
    within(
      screen.getByRole('table', { name: 'Активность по дням' }),
    ).getAllByRole('row'),
  ).toHaveLength(3);
  expect(api.commands).toHaveLength(0);
});

it('shows loading, safe error, explicit retry and empty period without a false zero report', async () => {
  const api = mockSession();
  const pending = Promise.withResolvers<FakeResponse>();
  api.overrides.set(
    '/api/analytics?period=30d&channel=all',
    () => pending.promise,
  );
  renderApp('/analytics');
  await screen.findByText('Загружаем аналитику…');
  await act(async () => {
    await Promise.resolve();
    pending.resolve(response({}, 503));
  });
  await screen.findByRole('alert');
  api.overrides.set('/api/analytics?period=30d&channel=all', () =>
    Promise.resolve(
      response({
        ...analyticsReport(),
        summary: { requests: 0, menuActions: 0 },
      }),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Повторить попытку' }));
  await screen.findByText('Пока нет активности');
  expect(screen.queryByRole('article')).toBeNull();
});

it.each([200, 401])(
  'ignores old filter response %i even when fetch ignores abort',
  async (status) => {
    const api = mockSession();
    const old = Promise.withResolvers<FakeResponse>();
    api.overrides.set(
      '/api/analytics?period=30d&channel=all',
      () => old.promise,
    );
    api.overrides.set('/api/analytics?period=30d&channel=vk', () =>
      Promise.resolve(
        response({
          ...analyticsReport(),
          summary: { requests: 27, menuActions: 83 },
        }),
      ),
    );
    renderApp('/analytics');
    await screen.findByText('Загружаем аналитику…');
    fireEvent.click(screen.getByRole('button', { name: 'VK' }));
    await screen.findByText('27');
    await act(async () => {
      await Promise.resolve();
      old.resolve(response(analyticsReport(), status));
    });
    expect(screen.getByText('27')).toBeDefined();
    expect(
      screen.queryByRole('heading', { name: 'Вход в управление' }),
    ).toBeNull();
  },
);

it('expires only the active session on analytics 401', async () => {
  const api = mockSession();
  api.overrides.set('/api/analytics?period=30d&channel=all', () =>
    Promise.resolve(response({}, 401)),
  );
  const { queryClient } = renderApp('/analytics');
  await screen.findByRole('heading', { name: 'Вход в управление' });
  await waitFor(() =>
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0),
  );
});
