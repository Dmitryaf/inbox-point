import { useState } from 'react';
import { addClassGroup } from '@frontend-common/entities/content/model/class-editor';
import {
  changeDraft,
  type ContentEditorProps,
  type OpenClass,
} from '@frontend/entities/content/model/editor-props';
import styles from '@frontend/entities/content/styles/class-editor.module.css';

export function ClassDirectionEditor(
  props: ContentEditorProps & { directionId: string; open: OpenClass },
) {
  const { draft, edit, directionId, open } = props;
  const [notice, setNotice] = useState('');
  const direction = draft.directions.find((item) => item.id === directionId);
  const groups = draft.groups.filter(
    (group) => group.directionId === directionId,
  );
  if (!direction) {
    return null;
  }
  function remove() {
    if (groups.length) {
      setNotice(
        'Сначала перенесите группы в другое направление или удалите их.',
      );
      return;
    }
    if (
      !window.confirm('Удалить направление и связанные с ним ключевые слова?')
    ) {
      return;
    }
    edit({
      directions: draft.directions.filter((item) => item.id !== directionId),
      keywords: draft.keywords.filter(
        (word) =>
          word.targetType !== 'direction' || word.targetId !== directionId,
      ),
    });
    open('direction', '');
  }
  return (
    <div className={styles['class-editor']}>
      {!groups.length && <p>Добавьте группу и укажите расписание.</p>}
      {groups.map((group) => (
        <button
          key={group.id}
          className={styles['class-list-item']}
          type="button"
          onClick={() => open('group', group.id)}
        >
          <strong>{group.name || 'Новая группа'}</strong>
          <small>
            {group.review
              ? 'Заполните данные группы'
              : group.enrollmentOpen
                ? 'Набор открыт'
                : 'Набор закрыт'}
          </small>
        </button>
      ))}
      <button
        type="button"
        disabled={draft.groups.filter((group) => !group.review).length >= 60}
        onClick={() => {
          let id: string | undefined;
          changeDraft(props, (next) => {
            id = addClassGroup(next, directionId);
          });
          if (id) {
            open('group', id);
          }
        }}
      >
        Добавить группу
      </button>
      <section className={styles['class-card']}>
        <label htmlFor={`direction-${directionId}`}>Название направления</label>
        <input
          id={`direction-${directionId}`}
          value={direction.name}
          maxLength={80}
          onChange={(event) =>
            edit({
              directions: draft.directions.map((item) =>
                item.id === directionId
                  ? { ...item, name: event.target.value }
                  : item,
              ),
            })
          }
        />
        <button type="button" className="danger" onClick={remove}>
          Удалить направление
        </button>
        {notice && <p role="status">{notice}</p>}
      </section>
    </div>
  );
}
