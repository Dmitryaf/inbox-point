import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { createEmptyContent } from '@frontend-common/entities/content/model/content-draft';
import { InformationEditor } from '@frontend/entities/content/ui/InformationEditor';
import { SaveBar } from '@frontend/features/save-content/ui/SaveBar';
import { contentFixture } from '@test/frontend/support/mock-content';
import {
  mountEditor,
  openInitialGroup,
  save,
} from '@test/frontend/widgets/content-workspace/class-test-helpers';

it('makes collapsed core sections visibly discoverable and expandable', async () => {
  const { container } = render(
    <InformationEditor
      draft={createEmptyContent()}
      edit={vi.fn()}
      issues={[]}
    />,
  );
  const prices = [...container.querySelectorAll('details')].find((item) =>
    item.querySelector('summary')?.textContent?.startsWith('Цены'),
  )!;
  expect(prices.open).toBe(false);
  expect(prices.querySelector('summary')?.textContent).toContain(
    'Не заполнено',
  );
  expect(prices.querySelector('summary')?.textContent).not.toContain(
    'настройки раздела',
  );
  expect(
    prices.querySelector('[class*="_disclosure-chevron_"]'),
  ).not.toBeNull();
  await userEvent.click(prices.querySelector('summary')!);
  expect(prices.open).toBe(true);
  expect(prices.querySelector('summary')?.textContent).toContain(
    'Не заполнено',
  );
});
it('explains invalid content and keeps Save available to open correction flow', () => {
  const onSave = vi.fn();
  const props = {
    dirty: true,
    saving: false,
    validationMessage: 'Заполните название и текст раздела.',
    onSave,
  };
  const { rerender } = render(<SaveBar {...props} />);
  expect(screen.getByRole('status').textContent).toContain(
    props.validationMessage,
  );
  const button = screen.getByRole('button', { name: 'Сохранить' });
  expect(button.hasAttribute('disabled')).toBe(false);
  fireEvent.click(button);
  expect(onSave).toHaveBeenCalledOnce();
  rerender(<SaveBar {...props} saving />);
  expect(button.textContent).toBe('Сохранить');
  expect(button.hasAttribute('disabled')).toBe(true);
});
it('ignores legacy direction words and creates and removes only group keywords', async () => {
  const initial = contentFixture();
  initial.content.keywords = [
    { phrase: 'Бачата', targetType: 'direction', targetId: 'dance' },
  ];
  const api = await mountEditor(initial);
  openInitialGroup();
  expect(screen.queryByLabelText('Слово или фраза 1')).toBeNull();
  expect(
    screen.queryByText('Сохранённое слово для всего направления'),
  ).toBeNull();
  expect(initial.content.keywords[0]?.targetType).toBe('direction');
  fireEvent.click(
    screen.getByRole('button', { name: 'Добавить ключевое слово' }),
  );
  fireEvent.change(screen.getByLabelText('Слово или фраза 1'), {
    target: { value: 'Бачата' },
  });
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.content.keywords).toEqual([
    { phrase: 'Бачата', targetType: 'group', targetId: 'group' },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Удалить слово' }));
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[1]?.content.keywords).toEqual([]);
});
