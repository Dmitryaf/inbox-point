import { describe, expect, it } from 'vitest';

import { vkSetupErrorMessage } from '@/modules/channel-setup/presentation/http/setup-error-message.js';

describe('vkSetupErrorMessage', () => {
  it('does not misreport a general VK access denial as disabled Long Poll', () => {
    expect(
      vkSetupErrorMessage(
        new Error('VK API groups.getLongPollServer failed with code 15'),
      ),
    ).toBe(
      'VK не дал ключу доступ к указанному сообществу. Проверьте, что ссылка и ключ относятся к одному сообществу.',
    );
  });

  it('gives separate actions for Long Poll and key configuration', () => {
    expect(
      vkSetupErrorMessage(new Error('VK Long Poll is disabled')),
    ).toContain('«Дополнительно» → «Работа с API» → «Long Poll API»');
    expect(
      vkSetupErrorMessage(
        new Error('VK Long Poll message_new event is disabled'),
      ),
    ).toContain('«Входящие сообщения»');
    expect(
      vkSetupErrorMessage(
        new Error('VK access token is missing manage permission'),
      ),
    ).toContain('«Управление сообществом»');
  });
});
