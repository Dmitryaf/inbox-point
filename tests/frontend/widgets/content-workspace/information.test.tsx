import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderApp } from '@test/frontend/support/render-app';
import { mockContent } from '@test/frontend/support/mock-content';

it('validates and focuses an incomplete FAQ without sending a write', async () => {
  const api = mockContent();
  renderApp('/manage');
  await screen.findByLabelText('Название организации');
  fireEvent.click(screen.getByRole('button', { name: 'Информация' }));
  await userEvent.click(
    screen.getByRole('button', { name: 'Добавить вопрос' }),
  );
  expect(document.activeElement?.id).toBe('faq-question-1');
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(document.activeElement?.id).toBe('faq-question-1');
  expect(
    document.getElementById('faq-question-1')?.getAttribute('aria-invalid'),
  ).toBe('true');
  expect(
    screen.getAllByText('Заполните вопрос и ответ в этой карточке.').length,
  ).toBeGreaterThan(0);
  expect(api.submissions).toHaveLength(0);
});
it('preserves FAQ identity and focus when reordering and confirms nonempty deletion', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const api = mockContent();
  renderApp('/manage');
  await screen.findByLabelText('Название организации');
  fireEvent.click(screen.getByRole('button', { name: 'Информация' }));
  await userEvent.click(
    screen.getByRole('button', { name: 'Добавить вопрос' }),
  );
  fireEvent.change(screen.getAllByLabelText('Вопрос')[1]!, {
    target: { value: 'Когда открыто?' },
  });
  fireEvent.change(screen.getAllByLabelText('Ответ')[1]!, {
    target: { value: 'Каждый день.' },
  });
  const moved = screen.getAllByLabelText('Вопрос')[1];
  await userEvent.click(
    screen.getByRole('button', { name: 'Переместить вопрос 2 выше' }),
  );
  expect(screen.getAllByLabelText('Вопрос')[0]).toBe(moved);
  expect(document.activeElement).toBe(moved);
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.content.faq?.[0]?.question).toBe('Когда открыто?');
  const first = screen
    .getAllByRole('group')
    .find((group) => group.tagName === 'FIELDSET')!;
  await userEvent.click(within(first).getByRole('button', { name: 'Удалить' }));
  expect(screen.getAllByLabelText('Вопрос')).toHaveLength(2);
  confirm.mockReturnValue(true);
  await userEvent.click(within(first).getByRole('button', { name: 'Удалить' }));
  expect(screen.getAllByLabelText('Вопрос')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[1]?.content.faq).toEqual([
    { question: 'Как записаться?', answer: 'Напишите нам.' },
  ]);
});
it('saves prices, address, FAQ and visibility while keeping the unported sections', async () => {
  const api = mockContent();
  renderApp('/manage');
  await screen.findByLabelText('Название организации');
  fireEvent.click(screen.getByRole('button', { name: 'Информация' }));
  const answers = screen.getByRole('region', { name: 'Основные ответы' });
  fireEvent.click(within(answers).getByText('Цены', { selector: 'strong' }));
  const [prices, address] = within(answers).getAllByLabelText('Текст ответа');
  fireEvent.change(prices!, { target: { value: 'Абонемент — 5000 ₽' } });
  fireEvent.change(address!, { target: { value: 'ул. Новая, 20' } });
  fireEvent.click(
    within(answers).getAllByRole('checkbox', { hidden: true })[0]!,
  );
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Запись в мессенджере.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.content).toMatchObject({
    prices: 'Абонемент — 5000 ₽',
    address: 'ул. Новая, 20',
    faq: [{ question: 'Как записаться?', answer: 'Запись в мессенджере.' }],
    visibleSections: ['schedule', 'faq'],
  });
  await waitFor(() =>
    expect(api.submissions[0]?.content.groups).toHaveLength(1),
  );
});
