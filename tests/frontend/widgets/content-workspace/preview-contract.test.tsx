import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createEmptyContent } from '@frontend-common/entities/content/model/content-draft';
import { clientMessages } from '@core/application/client-messages';
import { ContentPreview } from '@frontend/widgets/content-workspace/ui/ContentPreview';

const start = { action: 'main', sequence: 0 };
const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));
const transcript = () => screen.getByLabelText('Пример переписки').textContent;
it('opens an application question and explains the client answer step', () => {
  const draft = createEmptyContent();
  draft.customSections = [
    { label: 'Записаться', mode: 'application', text: 'Когда хотите прийти?' },
  ];
  render(<ContentPreview draft={draft} start={start} />);
  expect(transcript()).toContain(clientMessages.greeting);
  click('Записаться');
  expect(transcript()).toContain('Когда хотите прийти?');
  expect(transcript()).toContain(
    'Он придёт администратору как заявка «Записаться»',
  );
  expect(transcript()).not.toContain(clientMessages.applicationSent);
});
it('shows the real menu order and opens only the selected response', () => {
  const draft = createEmptyContent();
  draft.schedule = [
    { dayTime: 'Понедельник, 19:00', title: 'Бачата — начинающие' },
  ];
  draft.customSections = [
    { label: 'Подготовка', text: 'Возьмите сменную обувь.' },
  ];
  render(<ContentPreview draft={draft} start={start} />);
  const rows = [...screen.getByLabelText('Кнопки бота').children].map((row) =>
    [...row.querySelectorAll('button')].map((button) => button.textContent),
  );
  expect(rows).toEqual([['Расписание'], ['Подготовка'], ['Задать вопрос']]);
  expect(transcript()).toContain(clientMessages.greeting);
  click('Расписание');
  expect(transcript()).toContain('Понедельник, 19:00');
  expect(transcript()).not.toContain('Возьмите сменную обувь.');
});
function populated() {
  const draft = createEmptyContent();
  draft.directions.push({ id: 'dance', name: 'Тестовый танец' });
  draft.groups.push({
    id: 'group',
    directionId: 'dance',
    name: 'Начинающие',
    meetings: ['Пн 19:00'],
    description: '',
    enrollmentOpen: true,
    applicationQuestion: 'Когда хотите прийти?',
  });
  return draft;
}
it('uses shared navigation from menu to group, signup, prices and back', () => {
  const draft = populated();
  draft.prices = '500';
  render(<ContentPreview draft={draft} start={start} />);
  click('Расписание');
  click('Тестовый танец');
  expect(transcript()).not.toContain('Пн 19:00');
  click('Начинающие');
  expect(transcript()).toContain('Пн 19:00');
  click('Цены');
  expect(transcript()).toContain('500');
  click('К группе');
  click('Записаться на занятие');
  expect(transcript()).toContain('Когда хотите прийти?');
  expect(transcript()).toContain('Тестовый танец / Начинающие');
  click('Меню');
  expect(transcript()).toContain(clientMessages.greeting);
});
it('opens the selected group and reflects draft edits with one preview', () => {
  const draft = populated();
  const { container, rerender } = render(
    <ContentPreview
      draft={draft}
      start={{ action: 'classes:group:group', sequence: 1 }}
    />,
  );
  expect(transcript()).toContain('Начинающие');
  const updated = {
    ...draft,
    groups: [{ ...draft.groups[0]!, name: 'Новая группа' }],
  };
  rerender(
    <ContentPreview
      draft={updated}
      start={{ action: 'classes:group:group', sequence: 1 }}
    />,
  );
  expect(transcript()).toContain('Новая группа');
  rerender(
    <ContentPreview
      key={2}
      draft={updated}
      start={{ action: 'main', sequence: 2 }}
    />,
  );
  expect(transcript()).toContain(clientMessages.greeting);
  expect(
    container.querySelectorAll('[aria-label="Пример переписки"]'),
  ).toHaveLength(1);
});
