import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { createComponentModel } from './ClassGroupPreview.model';
export function renderClassGroupPreviewPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { select } = $state;
  const response = $state.response.value;

  return (
    <>
      <div className="class-preview-buttons" data-r-e40bbebd="">
        {$renderList(response.buttons, (item) => (
          <button
            key={item.action}
            type="button"
            onClick={() => void select(item.action)}
            data-r-e40bbebd=""
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
