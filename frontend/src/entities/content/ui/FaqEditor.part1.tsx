import type { createComponentModel } from './FaqEditor.model';
export function renderFaqEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const draft = $state.draft.value;

  return (
    <>
      <div className="section-heading" data-r-0b16243c="">
        <div data-r-0b16243c="">
          <p className="step" data-r-0b16243c="">
            {'Готовый раздел меню'}
          </p>
          <h2 data-r-0b16243c="">{'Частые вопросы'}</h2>
        </div>
        <span data-r-0b16243c="">
          {draft.faq.length}
          {' / 20'}
        </span>
      </div>
    </>
  );
}
