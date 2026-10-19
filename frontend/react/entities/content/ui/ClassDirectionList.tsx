import type {
  ContentEditorProps,
  OpenClass,
} from '@frontend/entities/content/model/editor-props';
import { ClassDirectionCreate } from './ClassDirectionCreate';
import { SectionVisibilityControl } from './SectionVisibilityControl';
import styles from '@frontend/entities/content/styles/class-editor.module.css';

export function ClassDirectionList(
  props: ContentEditorProps & {
    reviewing: boolean;
    review: () => void;
    open: OpenClass;
  },
) {
  const { draft, edit, open, reviewing, review } = props;
  const pending = draft.groups.filter((item) => item.review);
  if (reviewing) {
    return (
      <>
        {pending.map((item) => (
          <button
            key={item.id}
            className={styles['class-list-item']}
            type="button"
            onClick={() => open('group', item.id)}
          >
            <strong>
              {item.name ||
                (item.review?.source.split('\n')[0] ?? '') ||
                'Занятие'}
            </strong>
            <small>Заполните данные группы</small>
          </button>
        ))}
        {!pending.length && <p>Старых записей больше нет.</p>}
      </>
    );
  }
  return (
    <>
      {!!pending.length && (
        <button
          className={styles['review-notice']}
          type="button"
          onClick={review}
        >
          Старые записи расписания: {pending.length}
        </button>
      )}
      {!draft.directions.length && !pending.length && (
        <p>Добавьте направление, затем создайте в нём группы.</p>
      )}
      {draft.directions.map((item) => (
        <button
          key={item.id}
          className={styles['class-list-item']}
          type="button"
          onClick={() => open('direction', item.id)}
        >
          <strong>{item.name || 'Новое направление'}</strong>
          <small>
            Групп:{' '}
            {
              draft.groups.filter(
                (group) => group.directionId === item.id && !group.review,
              ).length
            }
          </small>
        </button>
      ))}
      <ClassDirectionCreate
        {...props}
        created={(id) => open('direction', id)}
      />
      <SectionVisibilityControl
        draft={draft}
        section="schedule"
        present={!!(draft.directions.length || draft.groups.length)}
        onChange={edit}
      />
    </>
  );
}
