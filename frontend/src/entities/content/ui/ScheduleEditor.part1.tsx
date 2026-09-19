import type { createComponentModel } from './ScheduleEditor.model';
export function renderScheduleEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const hasContent = $state.hasContent.value;

  return (
    <>
      <summary data-r-e7737cb0="">
        <span className="summary-copy" data-r-e7737cb0="">
          <strong data-r-e7737cb0="">{'Расписание'}</strong>
        </span>
        <span className="summary-meta" data-r-e7737cb0="">
          <small data-r-e7737cb0="">
            {hasContent ? 'Заполнено' : 'Не заполнено'}
          </small>
          <span
            aria-hidden="true"
            className="disclosure-chevron"
            data-r-e7737cb0=""
          />
        </span>
      </summary>
    </>
  );
}
