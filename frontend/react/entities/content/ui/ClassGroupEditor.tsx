import { removeClassGroup } from '@frontend-common/entities/content/model/class-editor';
import { duplicateClassGroup } from '@frontend-common/entities/content/model/class-enrollment';
import type { ClassGroup } from '@core/application/class-content';
import {
  changeDraft,
  type ContentEditorProps,
  type OpenClass,
} from '@frontend/entities/content/model/editor-props';
import { ClassEnrollmentSettings } from './ClassEnrollmentSettings';
import { ClassKeywordsEditor } from './ClassKeywordsEditor';
import styles from '@frontend/entities/content/styles/class-editor.module.css';

export function ClassGroupEditor(
  props: ContentEditorProps & {
    groupId: string;
    open: OpenClass;
    preview: (action: string) => void;
  },
) {
  const { draft, edit, groupId, open, preview } = props;
  const group = draft.groups.find((item) => item.id === groupId);
  if (!group) {
    return null;
  }
  const duplicate = duplicateClassGroup(draft.groups, group);
  const update = (next: ClassGroup) =>
    edit({
      groups: draft.groups.map((item) => (item.id === groupId ? next : item)),
    });
  return (
    <div className={styles['class-editor']}>
      {group.review && (
        <aside className={styles['class-review']}>
          <strong>Старое расписание</strong>
          <pre>{group.review.source}</pre>
          <p>
            Заполните название, дни и время занятий ниже, затем включите набор.
          </p>
          {duplicate && (
            <div role="alert">
              <p>
                Группа «{duplicate.name}» уже есть в этом направлении. Можно
                открыть её или удалить эту лишнюю запись.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => open('group', duplicate.id)}
              >
                Открыть существующую группу
              </button>
            </div>
          )}
        </aside>
      )}
      <label htmlFor={`group-direction-${group.id}`}>Направление</label>
      <select
        id={`group-direction-${group.id}`}
        value={group.directionId}
        onChange={(event) =>
          update({ ...group, directionId: event.target.value })
        }
      >
        <option value="">Выберите направление</option>
        {draft.directions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {!draft.directions.length && (
        <p className={styles['class-hint']}>
          Сначала добавьте направление на экране «Занятия».
        </p>
      )}
      <label htmlFor={`group-name-${group.id}`}>Название группы</label>
      <input
        id={`group-name-${group.id}`}
        value={group.name}
        maxLength={80}
        placeholder="Например, Начинающие"
        onChange={(event) => update({ ...group, name: event.target.value })}
      />
      <label htmlFor={`group-time-${group.id}-0`}>Дни и время занятий</label>
      <textarea
        id={`group-time-${group.id}-0`}
        value={group.meetings.join('\n')}
        rows={2}
        placeholder="Пн/Ср — 20:00 или Пн 20:00, Ср 19:00"
        onChange={(event) =>
          update({ ...group, meetings: event.target.value.split(/\r?\n/u) })
        }
      />
      <ClassEnrollmentSettings {...props} group={group} update={update} />
      <ClassKeywordsEditor {...props} targetId={group.id} />
      <div className={styles['class-actions']}>
        <button
          type="button"
          className="secondary-button"
          onClick={() => preview(`classes:group:${group.id}`)}
        >
          Посмотреть как клиент
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (
              window.confirm(
                'Удалить группу и её ключевые слова? Уже отправленные заявки сохранятся.',
              )
            ) {
              changeDraft(props, (next) => removeClassGroup(next, group.id));
              open('direction', group.directionId);
            }
          }}
        >
          Удалить группу
        </button>
      </div>
      <section className={styles['class-card']}>
        <label htmlFor={`group-description-${group.id}`}>
          Короткое описание группы
        </label>
        <textarea
          id={`group-description-${group.id}`}
          value={group.description}
          rows={3}
          maxLength={1000}
          onChange={(event) =>
            update({ ...group, description: event.target.value })
          }
        />
      </section>
    </div>
  );
}
