// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory } from 'vue-router';

import { createAdminRouter } from '@frontend/app/router';
import AdminPageHeader from '@frontend/widgets/admin-shell/ui/AdminPageHeader.vue';

describe('AdminPageHeader', () => {
  it('provides keyboard-accessible navigation between all admin sections', async () => {
    const router = createAdminRouter(createMemoryHistory());
    await router.push('/setup');
    const wrapper = mount(AdminPageHeader, {
      attachTo: document.body,
      global: { plugins: [router] },
      props: {
        current: 'channels',
        intro: 'Пояснение страницы.',
        showLogout: true,
        title: 'Каналы',
      },
    });

    const links = wrapper.get('nav').findAll('a');
    expect(links.map((link) => link.text())).toEqual([
      'Ответы',
      'Каналы',
      'Мониторинг',
    ]);
    expect(links.map((link) => link.attributes('href'))).toEqual([
      '/manage',
      '/setup',
      '/ops',
    ]);
    expect(links[1]?.attributes('aria-current')).toBe('page');

    links[2]?.element.focus();
    expect(document.activeElement).toBe(links[2]?.element);

    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('logout')).toHaveLength(1);
    wrapper.unmount();
  });

  it('hides logout in local bypass mode', () => {
    const router = createAdminRouter(createMemoryHistory());
    const wrapper = mount(AdminPageHeader, {
      global: { plugins: [router] },
      props: {
        current: 'answers',
        intro: 'Пояснение страницы.',
        showLogout: false,
        title: 'Ответы клиентам',
      },
    });

    expect(wrapper.find('nav').exists()).toBe(true);
    expect(wrapper.find('button').exists()).toBe(false);
  });
});
