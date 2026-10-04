// @vitest-environment jsdom
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { response, requestUrl } from '@test/frontend/support/fake-response';
import { mountAppAt } from '@test/frontend/support/mount-app';
import { analyticsReport } from './analytics-fixture';

describe('analytics request lifetime', () => {
  it('ignores an older response after filters change', async () => {
    let oldResolve!: (value: ReturnType<typeof response>) => void;
    let initial = true;
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      if (requestUrl(input).includes('/api/admin/session')) {
        return Promise.resolve(
          response({ authenticated: true, mode: 'password' }),
        );
      }
      if (initial) {
        initial = false;
        return new Promise((resolve) => {
          oldResolve = resolve;
        });
      }
      const report = analyticsReport();
      report.summary.requests = 27;
      return Promise.resolve(response(report));
    });
    const { wrapper } = await mountAppAt('/analytics');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'VK')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.get('.metric-value').text()).toBe('27');
    oldResolve(response(analyticsReport()));
    await flushPromises();
    expect(wrapper.get('.metric-value').text()).toBe('27');
    wrapper.unmount();
    vi.unstubAllGlobals();
  });
});
