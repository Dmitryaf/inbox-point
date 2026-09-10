// @vitest-environment jsdom

import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { requestUrl, response } from '@test/frontend/support/fake-response';
import { mountAppAt } from '@test/frontend/support/mount-app';

describe('OperationsDashboardPage authentication', () => {
  it('returns to login when the owner session expires', async () => {
    window.sessionStorage.clear();
    let authenticated = true;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated, mode: 'password' }));
        }
        authenticated = false;
        return Promise.resolve(
          response(
            { message: 'Войдите, чтобы увидеть состояние сервиса.' },
            401,
          ),
        );
      }),
    );

    const { router, wrapper } = await mountAppAt('/ops');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/login');
    expect(wrapper.text()).not.toContain('Состояние');
    expect(wrapper.find('.auth-card').exists()).toBe(true);
    wrapper.unmount();
    window.sessionStorage.clear();
  });
});
