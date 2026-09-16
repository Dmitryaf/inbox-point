import { describe, expect, it } from 'vitest';

import { clientMessages } from '@/core/application/client-messages.js';

describe('client messages', () => {
  it('keeps question, menu, and delivery outcomes distinct', () => {
    expect(clientMessages.questionPrompt).toBe(
      'Напишите свой вопрос. Мы ответим здесь.',
    );
    expect(clientMessages.activeMenu).toBe(
      'Меню открыто. Выберите нужное действие или просто напишите сообщение, чтобы продолжить разговор.',
    );
    expect(clientMessages.handoffSent).toBe(
      'Вопрос отправлен. Мы ответим здесь.',
    );
  });

  it('does not expose internal roles in client-facing text', () => {
    expect(
      Object.values(clientMessages).join('\n').toLowerCase(),
    ).not.toContain('оператор');
  });
});
