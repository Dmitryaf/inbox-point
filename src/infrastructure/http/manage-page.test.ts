import { Script } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { managePageHtml, managePageScript } from './manage-page.js';

describe('managed content page assets', () => {
  it('ships a syntactically valid browser script', () => {
    expect(() => new Script(managePageScript)).not.toThrow();
  });

  it('exposes the built-in structured FAQ editor in Russian', () => {
    expect(managePageHtml).toContain('<h2>Частые вопросы</h2>');
    expect(managePageHtml).toContain("id='faq-items'");
    expect(managePageHtml).toContain("id='add-faq'");
    expect(managePageHtml).not.toContain('Для FAQ выберите формат');
  });
});
