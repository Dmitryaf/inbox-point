// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';

import { createAdminRouter } from '@frontend/app/router';
import { openAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';
import AdminLoginPage from '@frontend/pages/admin-login/ui/AdminLoginPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';

describe('AdminLoginPage', () => {
  it('shows a dedicated login page and returns to the requested page', async () => {
    window.sessionStorage.clear();
    const router = createAdminRouter(createMemoryHistory());
    await router.push('/ops');
    openAdminLogin(router, '/ops', 'Сессия завершилась. Войдите снова.');

    let loginBody: unknown;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/admin/session')) {
          return Promise.resolve(response({ authenticated: false }));
        }
        if (url.endsWith('/admin/login')) {
          if (typeof init?.body !== 'string') {
            throw new Error('Expected a JSON login body');
          }
          loginBody = JSON.parse(init.body);
          return Promise.resolve(response({ authenticated: true }));
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }),
    );

    const wrapper = mount(AdminLoginPage, { global: { plugins: [router] } });
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/login');
    expect(wrapper.get('h1').text()).toBe('Вход в управление');
    expect(wrapper.get('.product-logo').text()).toBe('Inbox Point');
    expect(wrapper.get('.product-logo__mark').find('svg').exists()).toBe(true);
    expect(wrapper.text()).toContain('Сессия завершилась. Войдите снова.');
    expect(wrapper.text()).not.toContain('Состояние');

    await wrapper.get('#admin-password').setValue('synthetic-admin-password');
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('.auth-card').trigger('submit');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/ops');
    expect(loginBody).toEqual({
      password: 'synthetic-admin-password',
      rememberDevice: true,
    });
    expect(wrapper.text()).not.toContain('synthetic-admin-password');

    wrapper.unmount();
    window.history.replaceState(null, '', '/');
    window.sessionStorage.clear();
  });
});
