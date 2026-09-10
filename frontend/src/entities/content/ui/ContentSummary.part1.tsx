import AppIcon from '@frontend/shared/ui/AppIcon';

import type { createComponentModel } from './ContentSummary.model';
export function renderContentSummaryPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const totalCount = $state.totalCount.value;

  return (
    <>
      <div className="summary-heading" data-r-109c0780="">
        <span className="summary-icon" data-r-109c0780="">
          <AppIcon name="channel" data-r-109c0780="" />
        </span>
        <div data-r-109c0780="">
          <p data-r-109c0780="">{'Меню в каналах'}</p>
          <h3 id="content-summary-title" data-r-109c0780="">
            {totalCount ? 'Готово к показу' : 'Пока не заполнено'}
          </h3>
        </div>
      </div>
    </>
  );
}
