import type { InformationProps } from '@frontend/entities/content/ui/InformationEditor';
import { useCollectionEditor } from './use-collection-editor';
export function useFaqEditor({
  draft,
  edit,
}: Pick<InformationProps, 'draft' | 'edit'>) {
  return useCollectionEditor(draft.faq, (faq) => edit({ faq }), {
    create: () => ({ question: '', answer: '' }),
    limit: 20,
    prefix: 'faq-question',
    description: (item, index) =>
      `вопрос «${item.question.trim() || index + 1}»`,
    hasContent: (item) => !!(item.question.trim() || item.answer.trim()),
  });
}
