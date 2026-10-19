import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { contentFixture } from '@test/frontend/support/mock-content';
import {
  mountEditor,
  save,
} from '@test/frontend/widgets/content-workspace/class-test-helpers';
it('keeps FAQ identity and keyboard continuity through two downward moves and confirmed deletion', async () => {
  const initial = contentFixture();
  initial.content.faq = ['A', 'B', 'C'].map((question) => ({
    question,
    answer: `Answer ${question}`,
  }));
  const api = await mountEditor(initial);
  fireEvent.click(screen.getByRole('button', { name: 'Информация' }));
  const first = screen.getAllByLabelText('Вопрос')[0];
  expect(
    screen
      .getByRole('button', { name: 'Переместить вопрос 1 выше' })
      .hasAttribute('disabled'),
  ).toBe(true);
  expect(
    screen
      .getByRole('button', { name: 'Переместить вопрос 3 ниже' })
      .hasAttribute('disabled'),
  ).toBe(true);
  await userEvent.click(
    screen.getByRole('button', { name: 'Переместить вопрос 1 ниже' }),
  );
  expect(screen.getAllByLabelText('Вопрос')[1]).toBe(first);
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Переместить вопрос 2 ниже' }),
  );
  await userEvent.keyboard('{Enter}');
  expect(screen.getAllByLabelText('Вопрос')[2]).toBe(first);
  expect(document.activeElement).toBe(first);
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.content.faq?.map((item) => item.question)).toEqual(
    ['B', 'C', 'A'],
  );
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await userEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0]!);
  expect(screen.getAllByLabelText('Вопрос')).toHaveLength(3);
  confirm.mockReturnValue(true);
  await userEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0]!);
  expect(screen.getAllByLabelText('Вопрос')).toHaveLength(2);
  expect(document.activeElement).toBe(screen.getAllByLabelText('Вопрос')[0]);
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[1]?.content.faq?.map((item) => item.question)).toEqual(
    ['C', 'A'],
  );
});
