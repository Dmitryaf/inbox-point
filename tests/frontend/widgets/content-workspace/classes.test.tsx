import { act, fireEvent, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { contentFixture } from '@test/frontend/support/mock-content';
import {
  mountEditor,
  openInitialGroup,
  field,
  change,
  save,
} from './class-test-helpers';

it('creates groups with stable IDs, preserves meetings and keyword targets through rename and navigation', async () => {
  const api = await mountEditor();
  fireEvent.click(screen.getByRole('button', { name: 'Добавить направление' }));
  change('new-direction-name', 'Тестовый танец');
  fireEvent.submit(field('new-direction-name').closest('form')!);
  fireEvent.click(screen.getByRole('button', { name: 'Добавить группу' }));
  const groupId = screen
    .getByLabelText('Название группы')
    .id.slice('group-name-'.length);
  change(`group-name-${groupId}`, 'Начинающие');
  change(`group-time-${groupId}-0`, 'Понедельник, 19:00\nЧетверг, 19:00');
  fireEvent.click(screen.getByLabelText('Открыть набор в группу'));
  change(`group-question-${groupId}`, 'Когда хотите прийти?');
  change(`group-confirmation-${groupId}`, 'Запись подтверждена!');
  fireEvent.click(
    screen.getByRole('button', { name: 'Добавить ключевое слово' }),
  );
  change(`keyword-${groupId}-0`, 'Тестовый танец');
  fireEvent.click(
    screen.getByRole('button', { name: 'К направлению «Тестовый танец»' }),
  );
  const directionId = screen
    .getByLabelText('Название направления')
    .id.slice('direction-'.length);
  change(`direction-${directionId}`, 'Новое направление');
  fireEvent.click(screen.getByRole('button', { name: /^Начинающие/ }));
  expect(field(`group-time-${groupId}-0`).value).toBe(
    'Понедельник, 19:00\nЧетверг, 19:00',
  );
  save();
  await screen.findByText('Все изменения сохранены');
  expect(
    api.submissions[0]?.content.groups?.find((group) => group.id === groupId),
  ).toMatchObject({
    directionId,
    name: 'Начинающие',
    meetings: ['Понедельник, 19:00', 'Четверг, 19:00'],
    enrollmentOpen: true,
    confirmationText: 'Запись подтверждена!',
  });
  expect(api.submissions[0]?.content.keywords).toContainEqual({
    phrase: 'Тестовый танец',
    targetType: 'group',
    targetId: groupId,
  });
  await act(() => api.router.navigate('/setup'));
  await act(() => api.router.navigate('/manage'));
  await screen.findByLabelText('Название организации');
  fireEvent.click(screen.getByRole('button', { name: /^Новое направление/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Начинающие/ }));
  expect(field(`group-confirmation-${groupId}`).value).toBe(
    'Запись подтверждена!',
  );
});

it('blocks deleting a populated direction and removes only the selected group and its keywords after confirmation', async () => {
  const api = await mountEditor();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: /^Танец/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Удалить направление' }));
  expect(screen.getByText(/Сначала перенесите группы/)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /^Старое расписание/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Удалить группу' }));
  expect(field('group-name-group').value).toBe('Старое расписание');
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Удалить группу' }));
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.content.groups).toEqual([]);
  expect(api.submissions[0]?.content.keywords).toEqual([]);
  expect(api.submissions[0]?.content.directions).toEqual(
    contentFixture().content.directions,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Удалить направление' }));
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[1]?.content.directions).toEqual([]);
});

it('reports keyword conflicts with their destination and navigates without discarding edits', async () => {
  const initial = contentFixture();
  initial.content.groups!.push({
    ...initial.content.groups![0]!,
    id: 'other',
    name: 'Продолжающие',
  });
  initial.content.keywords!.push({
    phrase: 'ЗАНЯТИЕ',
    targetType: 'group',
    targetId: 'other',
  });
  await mountEditor(initial);
  openInitialGroup();
  change('group-description-group', 'Моя правка');
  expect(screen.getByRole('alert').textContent).toContain(
    'Танец / Продолжающие',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Перейти к настройке' }));
  expect(field('group-name-other').value).toBe('Продолжающие');
  fireEvent.click(screen.getByRole('button', { name: 'Перейти к настройке' }));
  expect(field('group-description-group').value).toBe('Моя правка');
});

it('keeps enrollment fields when closing enrollment and previews the current group draft', async () => {
  const api = await mountEditor();
  openInitialGroup();
  fireEvent.click(screen.getByLabelText('Открыть набор в группу'));
  change('group-question-group', 'Когда хотите прийти?');
  change('group-confirmation-group', 'Запись подтверждена!');
  change('group-time-group-0', 'Пн 20:00, Ср 19:00\nПятница, 19:00');
  fireEvent.click(
    screen.getByRole('button', { name: 'Посмотреть как клиент' }),
  );
  const preview = screen.getByLabelText('Пример переписки');
  expect(preview.textContent).toContain('Пн 20:00, Ср 19:00');
  fireEvent.click(
    within(preview).getByRole('button', { name: 'Записаться на занятие' }),
  );
  expect(preview.textContent).toContain('Когда хотите прийти?');
  fireEvent.click(screen.getByLabelText('Открыть набор в группу'));
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.content.groups?.[0]).toMatchObject({
    enrollmentOpen: false,
    applicationQuestion: 'Когда хотите прийти?',
    confirmationText: 'Запись подтверждена!',
    meetings: ['Пн 20:00, Ср 19:00', 'Пятница, 19:00'],
  });
});
