import { describe, expect, it } from 'vitest';

import expected from '@test/fixtures/client-response-preview.json';
import {
  buildClientResponsePreviews,
  formatFaqResponse,
} from '@frontend/entities/content/lib/client-response-preview';
import { validateContentDraft } from '@frontend/entities/content/lib/content-validation';
import { createEmptyContent } from '@frontend/entities/content/model/content-draft';

describe('client response preview', () => {
  it('matches the formatted responses produced by the backend catalog', () => {
    const content = createEmptyContent();
    content.schedule = 'Пн, 18:00\n- Ср, 19:00';
    content.address = '  ул. Мира, 1  ';
    content.faq = [{ answer: 'Напишите нам.', question: 'Как записаться?' }];
    const previews = buildClientResponsePreviews(content);

    expect(previews.map(({ label, text }) => [label, text])).toEqual(expected);
  });

  it('rejects a FAQ whose final formatted response exceeds the channel limit', () => {
    const content = createEmptyContent();
    content.faq = [
      { answer: 'a'.repeat(3_000), question: 'q'.repeat(300) },
      { answer: 'b'.repeat(700), question: 'Ещё один вопрос' },
    ];

    expect(formatFaqResponse(content.faq).length).toBeGreaterThan(4_000);
    expect(validateContentDraft(content)).toEqual({
      message:
        'Сократите раздел «Частые вопросы»: ответ длиннее 4000 символов.',
      valid: false,
    });
  });

  it('validates hidden responses and reserved custom button names', () => {
    const content = createEmptyContent();
    content.visibleSections = [];
    content.schedule = 'x'.repeat(4_000);

    expect(validateContentDraft(content).valid).toBe(false);

    content.schedule = '';
    content.customSections = [{ label: ' FAQ ', text: 'Ответ' }];
    expect(validateContentDraft(content)).toEqual({
      message: 'Название своего раздела совпадает со служебной кнопкой.',
      valid: false,
    });
  });
});
