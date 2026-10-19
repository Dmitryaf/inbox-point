import type { ContentSnapshot } from '@frontend-common/entities/content/model/types';
import {
  groupContent,
  initialVersion,
} from '@test/frontend/pages/content-management/content-management-test-helpers';
import { response } from '@test/frontend/support/fake-response';
import { mockSession } from './mock-session';

export function contentFixture(): ContentSnapshot {
  return {
    version: initialVersion,
    content: {
      ...groupContent('Старое расписание'),
      organizationName: 'Учебная организация',
      prices: 'Пробное занятие — бесплатно.',
      address: 'ул. Примерная, 10',
      faq: [{ question: 'Как записаться?', answer: 'Напишите нам.' }],
      customSections: [
        {
          id: 'custom',
          label: 'О школе',
          text: 'Сохранённый текст',
          mode: 'information',
        },
      ],
      keywords: [{ phrase: 'занятие', targetType: 'group', targetId: 'group' }],
      visibleSections: ['schedule', 'prices', 'faq'],
    },
  };
}
export function mockContent(initial = contentFixture()) {
  const api = mockSession();
  let snapshot = initial;
  const submissions: ContentSnapshot[] = [];
  api.overrides.set('/api/manage/content', (init) => {
    if (init?.method === 'POST') {
      if (typeof init.body !== 'string') {
        throw new Error('Expected content JSON');
      }
      const submission = JSON.parse(init.body) as ContentSnapshot;
      submissions.push(submission);
      snapshot = { content: submission.content, version: 'b'.repeat(64) };
    }
    return Promise.resolve(response(snapshot));
  });
  api.overrides.set('/api/manage/content/history', () =>
    Promise.resolve(
      response({
        history: [
          {
            revision: 2,
            changedAt: '2026-09-02T12:00:00Z',
            sections: ['prices'],
          },
          {
            revision: 1,
            changedAt: '2026-09-01T12:00:00Z',
            sections: ['prices'],
          },
        ],
      }),
    ),
  );
  api.overrides.set('/api/manage/content/history/1', () =>
    Promise.resolve(response(initial)),
  );
  api.overrides.set('/api/manage/content/restore', () => {
    snapshot = { ...initial, version: 'c'.repeat(64) };
    return Promise.resolve(response(snapshot));
  });
  return { ...api, submissions, snapshot: () => snapshot };
}
