import { AppIcon } from '@frontend/shared/ui/AppIcon';
import {
  editorSections,
  workspaceViews,
} from '@frontend/widgets/content-workspace/model/navigation';
import type {
  EditorSection,
  WorkspaceView,
} from '@frontend/widgets/content-workspace/model/navigation';
import styles from '@frontend/widgets/content-workspace/styles/workspace-navigation.module.css';

export function WorkspaceNavigation({
  section,
  view,
  openSection,
  setView,
}: {
  section: EditorSection;
  view: WorkspaceView;
  openSection: (section: EditorSection) => void;
  setView: (view: WorkspaceView) => void;
}) {
  return (
    <>
      <div className={styles['mobile-workspace-navigation']}>
        <div className={styles['mobile-navigation-field']}>
          <label htmlFor="workspace-view">Режим</label>
          <select
            id="workspace-view"
            value={view}
            onChange={(event) => {
              const next = workspaceViews.find(
                (item) => item.id === event.target.value,
              );
              if (next) {
                setView(next.id);
              }
            }}
          >
            {workspaceViews.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id === 'edit'
                  ? 'Редактор'
                  : item.id === 'preview'
                    ? 'Просмотр'
                    : item.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles['mobile-navigation-field']}>
          <label htmlFor="editor-section">Раздел</label>
          <select
            id="editor-section"
            value={view === 'edit' ? section : ''}
            onChange={(event) => {
              const next = editorSections.find(
                (item) => item.id === event.target.value,
              );
              if (next) {
                openSection(next.id);
              }
            }}
          >
            <option disabled value="">
              Перейти к разделу
            </option>
            {editorSections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <nav
        className={`${styles['workspace-tabs']} ${styles['desktop-workspace-navigation']}`}
        aria-label="Режим работы"
      >
        {workspaceViews.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles['navigation-button']} ${view === item.id ? styles.active : ''}`}
            aria-pressed={view === item.id}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <aside className={styles['dashboard-sidebar']}>
        <nav
          className={styles['sidebar-group']}
          aria-label="Разделы информации"
        >
          <p>Разделы</p>
          {editorSections.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles['section-button']} ${view === 'edit' && section === item.id ? styles.active : ''}`}
              aria-pressed={view === 'edit' && section === item.id}
              onClick={() => openSection(item.id)}
            >
              <AppIcon name={item.id} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
