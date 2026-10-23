import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createEmptyContent } from '@frontend-common/entities/content/model/content-draft';
import { ContentSummary } from '@frontend/entities/content/ui/ContentSummary';

it('summarizes only client-visible content without hiding the summary', () => {
  const draft = createEmptyContent();
  draft.schedule = [{ dayTime: 'Monday, 19:00', title: 'Beginners' }];
  draft.prices = 'Single visit: 10';
  draft.visibleSections = ['schedule', 'address', 'faq'];
  draft.customSections.push({ label: 'First visit', text: 'Come early.' });
  const { container } = render(<ContentSummary draft={draft} />);
  expect(container.textContent).toContain('Готово к показу');
  expect(container.textContent).toContain('1 из 4');
  expect(container.textContent).toContain('Свои разделы1');
  expect(container.querySelector('details, summary')).toBeNull();
});
it('does not count a fully empty schedule card as ready', () => {
  const draft = createEmptyContent();
  draft.schedule = [{ dayTime: ' ', description: '', title: '' }];
  const { container } = render(<ContentSummary draft={draft} />);
  expect(container.textContent).toContain('Пока не заполнено');
  expect(container.textContent).toContain('0 из 4');
});
it('keeps an empty custom section out of the menu and reports invalid fields', () => {
  const draft = createEmptyContent();
  draft.address = 'Test address';
  draft.customSections = [{ label: '', text: '' }];
  const { container, rerender } = render(<ContentSummary draft={draft} />);
  expect(container.textContent).toContain('Нужно исправить поля');
  expect(container.textContent).toContain('Ответов в меню: 1');
  expect(container.textContent).toContain('Свои разделы0');
  expect(container.textContent).not.toContain('Готово к показу');
  rerender(
    <ContentSummary
      draft={{
        ...draft,
        customSections: [{ label: 'First visit', text: 'Come early.' }],
      }}
    />,
  );
  expect(container.textContent).toContain('Готово к показу');
  expect(container.textContent).toContain('Ответов в меню: 2');
});
it.each([
  { ...createEmptyContent(), faq: [{ question: 'Question', answer: '' }] },
  { ...createEmptyContent(), address: 'x'.repeat(4000) },
])(
  'does not claim readiness for incomplete FAQ or oversized answers',
  (draft) => {
    const { container } = render(<ContentSummary draft={draft} />);
    expect(container.textContent).toContain('Нужно исправить поля');
  },
);
