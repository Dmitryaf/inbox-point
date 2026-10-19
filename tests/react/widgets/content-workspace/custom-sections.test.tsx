import { act, fireEvent, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { mountEditor, change, field, save } from './class-test-helpers';

it('changes section purpose without losing its ID or question and previews the application flow', async () => {
  const api = await mountEditor();
  fireEvent.click(
    screen.getByRole('button', { name: 'Дополнительные кнопки' }),
  );
  expect(
    screen.getByLabelText(/Показать информацию/).getAttribute('checked'),
  ).not.toBeNull();
  fireEvent.click(screen.getByLabelText(/Принять заявку/));
  expect(screen.getByLabelText('Что спросить у клиента?')).toBe(
    field('section-text-0'),
  );
  expect(field('section-text-0').value).toBe('Сохранённый текст');
  change('section-label-0', 'Заказать звонок');
  change('section-text-0', 'Когда удобно позвонить?');
  fireEvent.click(screen.getByText('Предпросмотр', { selector: 'summary' }));
  const preview = screen.getByLabelText('Пример переписки');
  fireEvent.click(
    within(preview).getByRole('button', { name: 'Заказать звонок' }),
  );
  expect(preview.textContent).toContain('Когда удобно позвонить?');
  expect(preview.textContent).toContain('как заявка «Заказать звонок»');
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.content.customSections).toEqual([
    {
      id: 'custom',
      mode: 'application',
      label: 'Заказать звонок',
      text: 'Когда удобно позвонить?',
    },
  ]);
  await act(() => api.router.navigate('/setup'));
  await act(() => api.router.navigate('/manage'));
  await screen.findByLabelText('Название организации');
  fireEvent.click(
    screen.getByRole('button', { name: 'Дополнительные кнопки' }),
  );
  expect(field('section-text-0').value).toBe('Когда удобно позвонить?');
});
it('adds, reorders and confirms deletion while preserving IDs and keyboard focus', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const api = await mountEditor();
  fireEvent.click(
    screen.getByRole('button', { name: 'Дополнительные кнопки' }),
  );
  for (const title of ['Подготовка', 'Парковка']) {
    fireEvent.click(screen.getByRole('button', { name: 'Добавить раздел' }));
    const fields = screen.getAllByLabelText('Название кнопки');
    expect(document.activeElement).toBe(fields.at(-1));
    fireEvent.change(fields.at(-1)!, { target: { value: title } });
    change(`section-text-${fields.length - 1}`, 'Текст');
  }
  const first = field('section-label-0');
  fireEvent.click(
    screen.getByRole('button', { name: 'Переместить раздел 1 ниже' }),
  );
  expect(field('section-label-1')).toBe(first);
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Переместить раздел 2 ниже' }),
  );
  fireEvent.click(document.activeElement!);
  expect(field('section-label-2')).toBe(first);
  expect(document.activeElement).toBe(first);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Удалить раздел' })[0]!,
  );
  expect(screen.getAllByLabelText('Название кнопки')).toHaveLength(3);
  confirm.mockReturnValue(true);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Удалить раздел' })[0]!,
  );
  expect(document.activeElement).toBe(field('section-label-0'));
  save();
  await screen.findByText('Все изменения сохранены');
  expect(
    api.submissions[0]?.content.customSections?.map((item) => item.label),
  ).toEqual(['Парковка', 'О школе']);
  expect(api.submissions[0]?.content.customSections?.[1]?.id).toBe('custom');
});
it('opens the hidden section and focuses its invalid field instead of submitting', async () => {
  const api = await mountEditor();
  fireEvent.click(
    screen.getByRole('button', { name: 'Дополнительные кнопки' }),
  );
  change('section-label-0', 'Меню');
  fireEvent.click(screen.getByRole('button', { name: 'Занятия' }));
  save();
  expect(document.activeElement).toBe(field('section-label-0'));
  expect(field('section-label-0').getAttribute('aria-invalid')).toBe('true');
  expect(api.submissions).toHaveLength(0);
});
