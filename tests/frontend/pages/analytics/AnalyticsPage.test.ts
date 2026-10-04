// @vitest-environment jsdom
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { mountAppAt } from '@test/frontend/support/mount-app';
import { analyticsReport } from './analytics-fixture';

afterEach(() => vi.unstubAllGlobals());
function authenticatedFetch(
  loader: (url: string) => Promise<ReturnType<typeof response>>,
) {
  const mock = vi.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input);
    return url.includes('/api/admin/session')
      ? Promise.resolve(response({ authenticated: true, mode: 'password' }))
      : loader(url);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('AnalyticsPage', () => {
  it('loads the route, displays understandable data, and changes all filters', async () => {
    const mock = authenticatedFetch(() =>
      Promise.resolve(response(analyticsReport())),
    );
    const { wrapper, router } = await mountAppAt('/analytics');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('analytics');
    expect(wrapper.get('nav a[aria-current="page"]').text()).toBe('Аналитика');
    expect(wrapper.text()).toContain('Выборы в меню');
    expect(wrapper.text()).toContain('Telegram: 8 · VK: 6');
    expect(wrapper.text()).toContain('Записаться на пробное');
    expect(wrapper.text()).not.toContain('synthetic-id');
    expect(wrapper.find('svg.activity-chart').exists()).toBe(true);
    for (const label of [
      '7 дней',
      '90 дней',
      '30 дней',
      'Telegram',
      'VK',
      'Все каналы',
    ]) {
      await wrapper
        .findAll('button')
        .find((button) => button.text() === label)!
        .trigger('click');
      await flushPromises();
      expect(
        wrapper
          .findAll('button')
          .find((button) => button.text() === label)!
          .attributes('aria-pressed'),
      ).toBe('true');
    }
    expect(mock.mock.calls.map(([input]) => requestUrl(input))).toEqual(
      expect.arrayContaining([
        '/api/analytics?period=7d&channel=all',
        '/api/analytics?period=90d&channel=all',
        '/api/analytics?period=30d&channel=telegram',
        '/api/analytics?period=30d&channel=vk',
      ]),
    );
    wrapper.unmount();
  });

  it('shows loading, a recoverable error, and a meaningful empty period', async () => {
    let resolveRequest!: (value: ReturnType<typeof response>) => void;
    let first = true;
    authenticatedFetch(() => {
      if (first) {
        first = false;
        return new Promise((resolve) => {
          resolveRequest = resolve;
        });
      }
      const report = analyticsReport();
      report.summary = { requests: 0, menuActions: 0 };
      return Promise.resolve(response(report));
    });
    const { wrapper } = await mountAppAt('/analytics');
    await flushPromises();
    expect(wrapper.text()).toContain('Загружаем аналитику');
    resolveRequest(response({}, 503));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Не удалось загрузить аналитику',
    );
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить попытку')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Пока нет активности');
    expect(wrapper.find('.analytics-overview').exists()).toBe(false);
    wrapper.unmount();
  });

  it('keeps the page visible when requests exist without menu actions', async () => {
    const report = analyticsReport();
    report.summary.menuActions = 0;
    report.actions = [];
    authenticatedFetch(() => Promise.resolve(response(report)));
    const { wrapper } = await mountAppAt('/analytics');
    await flushPromises();
    expect(wrapper.text()).toContain('За этот период действий меню пока нет');
    expect(wrapper.text()).not.toContain('Пока нет активности');
    wrapper.unmount();
  });

  it('expires the admin session when the API denies access', async () => {
    let expired = false;
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      if (requestUrl(input).includes('/api/admin/session')) {
        return Promise.resolve(
          response({ authenticated: !expired, mode: 'password' }),
        );
      }
      expired = true;
      return Promise.resolve(response({}, 401));
    });
    const { wrapper, router } = await mountAppAt('/analytics');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/login');
    wrapper.unmount();
  });
});
