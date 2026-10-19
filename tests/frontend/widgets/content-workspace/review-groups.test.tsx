import { fireEvent, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { contentFixture } from '@test/frontend/support/mock-content';
import { mountEditor, change, field, save } from './class-test-helpers';

function reviewed(duplicate = false) {
  const initial = contentFixture();
  initial.content.groups!.push({
    ...initial.content.groups![0]!,
    id: 'review',
    directionId: duplicate ? 'dance' : '',
    name: duplicate ? 'Старое расписание' : '',
    meetings: [],
    review: { source: 'Необычная запись\nСреда, 21:00\nС нуля' },
  });
  return initial;
}
it('keeps an unreviewed source unchanged through save and reload', async () => {
  const initial = reviewed();
  const api = await mountEditor(initial);
  change('organization-name', 'Новое название');
  save();
  await screen.findByText('Все изменения сохранены');
  expect(
    api.submissions[0]?.content.groups?.find((group) => group.id === 'review'),
  ).toEqual(initial.content.groups![1]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Старые записи расписания: 1' }),
  );
  fireEvent.click(screen.getByRole('button', { name: /^Необычная запись/ }));
  expect(
    screen.getByText(initial.content.groups![1]!.review!.source, {
      selector: 'pre',
      normalizer: (text) => text,
    }),
  ).toBeDefined();
});
it('keeps source and closed enrollment on missing fields, then completes the same group by opening enrollment', async () => {
  const api = await mountEditor(reviewed());
  fireEvent.click(
    screen.getByRole('button', { name: 'Старые записи расписания: 1' }),
  );
  fireEvent.click(screen.getByRole('button', { name: /^Необычная запись/ }));
  fireEvent.click(screen.getByLabelText('Открыть набор в группу'));
  expect(screen.getByRole('alert').textContent).toContain(
    'Выберите направление',
  );
  expect(
    (
      field('group-name-review')
        .closest('section')
        ?.querySelector('input[type=checkbox]') as HTMLInputElement | null
    )?.checked,
  ).not.toBe(true);
  change('group-direction-review', 'dance');
  change('group-name-review', 'Новая группа');
  change('group-time-review-0', 'Среда, 21:00');
  change('group-description-review', 'С нуля');
  fireEvent.click(screen.getByLabelText('Открыть набор в группу'));
  save();
  await screen.findByText('Все изменения сохранены');
  expect(
    api.submissions[0]?.content.groups?.find((group) => group.id === 'review'),
  ).toMatchObject({
    id: 'review',
    directionId: 'dance',
    name: 'Новая группа',
    meetings: ['Среда, 21:00'],
    enrollmentOpen: true,
  });
  expect(
    api.submissions[0]?.content.groups?.find((group) => group.id === 'review')
      ?.review,
  ).toBeUndefined();
});
it('explains a duplicate and does not discard the old source after rejected enrollment', async () => {
  const initial = reviewed(true);
  const api = await mountEditor(initial);
  fireEvent.click(
    screen.getByRole('button', { name: 'Старые записи расписания: 1' }),
  );
  fireEvent.click(screen.getByRole('button', { name: /^Старое расписание/ }));
  fireEvent.click(screen.getByLabelText('Открыть набор в группу'));
  expect(
    screen
      .getAllByRole('alert')
      .some((item) => item.textContent?.includes('уже есть')),
  ).toBe(true);
  change('organization-name', 'Другая организация');
  save();
  await screen.findByText('Все изменения сохранены');
  expect(
    api.submissions[0]?.content.groups?.find((group) => group.id === 'review')
      ?.review?.source,
  ).toBe(initial.content.groups![1]!.review!.source);
  fireEvent.click(
    screen.getByRole('button', { name: 'Открыть существующую группу' }),
  );
  expect(field('group-name-group').value).toBe('Старое расписание');
});
