import type {
  ContentDraft,
  InformationSectionId,
} from '@frontend-common/entities/content/model/types';
import styles from '@frontend/entities/content/styles/section-visibility-control.module.css';

export function SectionVisibilityControl({
  draft,
  section,
  present,
  onChange,
}: {
  draft: ContentDraft;
  section: InformationSectionId;
  present: boolean;
  onChange: (change: Partial<ContentDraft>) => void;
}) {
  return (
    <label className={styles['visibility-control']}>
      <input
        type="checkbox"
        checked={draft.visibleSections.includes(section)}
        onChange={(event) => {
          onChange({
            visibleSections: event.target.checked
              ? [...draft.visibleSections, section]
              : draft.visibleSections.filter((item) => item !== section),
          });
        }}
      />
      <span>
        Показывать клиентам
        {!present && <small>Пустой раздел всё равно не появится в меню.</small>}
      </span>
    </label>
  );
}
