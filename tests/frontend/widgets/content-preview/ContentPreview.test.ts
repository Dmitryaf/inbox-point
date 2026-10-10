// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createEmptyContent } from '@frontend/entities/content/model/content-draft';
import { populated } from '@test/frontend/entities/content/class-editor-test-helpers';
import { clientMessages } from '@core/application/client-messages';
import ContentPreview from '@frontend/widgets/content-preview/ui/ContentPreview.vue';

describe('ContentPreview', () => {
  it('opens an application question on click and explains the client answer step', async () => {
    const content = createEmptyContent();
    content.customSections = [
      {
        label: 'Записаться',
        mode: 'application',
        text: 'Когда хотите прийти?',
      },
    ];
    const wrapper = mount(ContentPreview, { props: { content } });
    expect(wrapper.get('.preview-response').text()).toBe(
      clientMessages.greeting,
    );
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'Записаться')!
      .trigger('click');
    expect(wrapper.get('.preview-response').text()).toContain(
      'Когда хотите прийти?',
    );
    expect(wrapper.get('.preview-response').text()).toContain(
      'Он придёт администратору как заявка «Записаться»',
    );
    expect(wrapper.get('.preview-response').text()).not.toContain(
      clientMessages.applicationSent,
    );
  });
  it('shows the client menu in its real order and opens only the selected response', async () => {
    const content = createEmptyContent();
    content.schedule = [
      { dayTime: 'Понедельник, 19:00', title: 'Бачата — начинающие' },
    ];
    content.customSections = [
      { label: 'Подготовка', text: 'Возьмите сменную обувь.' },
    ];
    const wrapper = mount(ContentPreview, { props: { content } });
    const rows = wrapper
      .get('.message-preview-buttons')
      .findAll('.message-preview-button-row')
      .map((row) => row.findAll('button').map((item) => item.text()));
    expect(rows).toEqual([['Расписание'], ['Подготовка'], ['Задать вопрос']]);
    expect(wrapper.get('.preview-service-message').text()).toBe(
      clientMessages.greeting,
    );
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'Расписание')!
      .trigger('click');
    expect(wrapper.findAll('.preview-service-message')).toHaveLength(1);
    expect(wrapper.get('.preview-service-message').text()).toContain(
      'Понедельник, 19:00',
    );
    expect(wrapper.text()).not.toContain('Возьмите сменную обувь.');
  });
  it('uses the shared bot navigation from menu to group, signup, prices and back', async () => {
    const content = populated();
    content.groups[0]!.enrollmentOpen = true;
    content.groups[0]!.applicationQuestion = 'Когда хотите прийти?';
    content.prices = '500';
    const wrapper = mount(ContentPreview, { props: { content } });
    const click = async (label: string) => {
      await wrapper
        .findAll('button')
        .find((item) => item.text() === label)!
        .trigger('click');
    };
    await click('Расписание');
    await click('Тестовый танец');
    expect(wrapper.get('.preview-service-message').text()).not.toContain(
      'Пн 19:00',
    );
    await click('Начинающие');
    expect(wrapper.get('.preview-service-message').text()).toContain(
      'Пн 19:00',
    );
    await click('Цены');
    expect(wrapper.get('.preview-service-message').text()).toContain('500');
    await click('К группе');
    await click('Записаться на занятие');
    expect(wrapper.get('.preview-response').text()).toContain(
      'Когда хотите прийти?',
    );
    expect(wrapper.get('.preview-response').text()).toContain(
      'Тестовый танец / Начинающие',
    );
    await click('Меню');
    expect(wrapper.get('.preview-service-message').text()).toBe(
      clientMessages.greeting,
    );
  });
  it('opens the selected group and reflects draft edits without a second preview', async () => {
    const content = populated();
    const wrapper = mount(ContentPreview, {
      props: { content, startAction: 'classes:group:group' },
    });
    expect(wrapper.get('.preview-service-message').text()).toContain(
      'Начинающие',
    );
    content.groups[0]!.name = 'Новая группа';
    await wrapper.setProps({ content });
    expect(wrapper.get('.preview-service-message').text()).toContain(
      'Новая группа',
    );
    await wrapper.setProps({ startAction: 'main' });
    expect(wrapper.get('.preview-service-message').text()).toBe(
      clientMessages.greeting,
    );
    expect(wrapper.findAll('.preview')).toHaveLength(1);
  });
});
