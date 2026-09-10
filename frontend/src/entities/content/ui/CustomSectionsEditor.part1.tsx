import type { createComponentModel } from './CustomSectionsEditor.model';
export function renderCustomSectionsEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const sections = $state.sections.value;

  return (
    <>
      <div className="section-heading" data-r-c3e93385="">
        <div data-r-c3e93385="">
          <p className="step" data-r-c3e93385="">
            {'Свои кнопки'}
          </p>
          <h2 data-r-c3e93385="">{'Дополнительные разделы'}</h2>
        </div>
        <span data-r-c3e93385="">
          {sections.length}
          {' / 6'}
        </span>
      </div>
    </>
  );
}
