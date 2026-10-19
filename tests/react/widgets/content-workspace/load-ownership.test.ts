import { expect, it } from 'vitest';
import { createAppQueryClient } from '@frontend/app/query-client';
import {
  normalizeContentDraft,
  snapshotContent,
} from '@frontend-common/entities/content/model/content-draft';
import { preserveContentDraft } from '@frontend-common/features/content-draft/model/draft-recovery';
import { loadEditor } from '@frontend/widgets/content-workspace/model/editor-reads';
import { initialEditorState } from '@frontend/widgets/content-workspace/model/editor-state';
import type { EditorContext } from '@frontend/widgets/content-workspace/model/editor-context';
import { contentFixture, mockContent } from '@test/react/support/mock-content';

it('consumes recovery once when two load callers share the same response', async () => {
  mockContent();
  const saved = normalizeContentDraft(contentFixture().content);
  preserveContentDraft(
    { ...saved, organizationName: 'Восстановленный черновик' },
    snapshotContent(saved),
    contentFixture().version,
  );
  const context: EditorContext = {
    lifetime: {
      current: {
        state: initialEditorState(),
        active: true,
        generation: 1,
        command: false,
        released: false,
        previewSequence: 0,
      },
    },
    cache: createAppQueryClient(),
    epoch: 1,
    report: () => 'Ошибка загрузки',
    patch(change) {
      context.lifetime.current.state = {
        ...context.lifetime.current.state,
        ...change,
      };
    },
  };
  await Promise.all([loadEditor(context), loadEditor(context)]);
  expect(context.lifetime.current.state.draft?.organizationName).toBe(
    'Восстановленный черновик',
  );
  expect(context.lifetime.current.state.version).toBe(contentFixture().version);
  expect(sessionStorage.getItem('inbox-point:content-draft')).toBeNull();
  context.cache.clear();
});
