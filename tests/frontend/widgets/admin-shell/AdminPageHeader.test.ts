// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AdminPageHeader from '@frontend/widgets/admin-shell/ui/AdminPageHeader.vue';

describe('AdminPageHeader', () => {
  it('provides keyboard-accessible navigation between all admin sections', async () => {
    const wrapper = mount(AdminPageHeader, {
      attachTo: document.body,
      props: {
        authenticated: true,
        current: 'channels',
        intro: 'Пояснение страницы.',
        title: 'Каналы',
      },
    });

    const links = wrapper.get('nav').findAll('a');
    expect(links.map((link) => link.text())).toEqual([
      'Информация',
      'Каналы',
      'Состояние',
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

  it('hides navigation and logout before authentication', () => {
    const wrapper = mount(AdminPageHeader, {
      props: {
        authenticated: false,
        current: 'information',
        intro: 'Пояснение страницы.',
        title: 'Информация',
      },
    });

    expect(wrapper.find('nav').exists()).toBe(false);
    expect(wrapper.find('button').exists()).toBe(false);
  });
});
