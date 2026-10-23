import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { analyticsReport } from '@test/frontend/support/analytics-fixture';
import { mockSession } from '@test/frontend/support/mock-session';
import { renderApp } from '@test/frontend/support/render-app';

it('keeps a report with requests but no menu actions and preserves missing last-request context', async () => {
  const api = mockSession();
  const report = analyticsReport();
  report.summary.menuActions = 0;
  report.actions = [];
  report.lastRequestAt = null;
  api.overrides.set('/api/analytics?period=30d&channel=all', () =>
    Promise.resolve(response(report)),
  );
  renderApp('/analytics');
  await screen.findByRole('article');
  expect(
    screen.getByText('За этот период действий меню пока нет.'),
  ).toBeDefined();
  expect(screen.getByText('За этот период обращений пока нет.')).toBeDefined();
  expect(screen.queryByText('Пока нет активности')).toBeNull();
});

it.each(['/analytics', '/setup'])(
  'does not request protected data before login at %s',
  async (path) => {
    const api = mockSession(false);
    renderApp(path);
    await screen.findByRole('heading', { name: 'Вход в управление' });
    expect(
      api.fetchMock.mock.calls.some(
        ([input]) =>
          requestUrl(input).includes('/api/setup/') ||
          requestUrl(input).includes('/api/analytics?'),
      ),
    ).toBe(false);
  },
);
