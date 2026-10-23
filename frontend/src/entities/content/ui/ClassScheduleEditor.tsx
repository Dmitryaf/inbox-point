import { useLayoutEffect, useRef, useState } from 'react';
import type {
  ContentEditorProps,
  OpenClass,
} from '@frontend/entities/content/model/editor-props';
import { ClassDirectionList } from './ClassDirectionList';
import { ClassDirectionEditor } from './ClassDirectionEditor';
import { ClassGroupEditor } from './ClassGroupEditor';
import styles from '@frontend/entities/content/styles/class-editor.module.css';

export function ClassScheduleEditor(
  props: ContentEditorProps & { preview: (action: string) => void },
) {
  const { draft } = props;
  const [target, setTarget] = useState({ type: 'direction', id: '' });
  const [reviewing, setReviewing] = useState(false);
  const focus = useRef(false);
  useLayoutEffect(() => {
    if (focus.current) {
      document.getElementById('class-directions')?.focus();
      focus.current = false;
    }
  });
  const open: OpenClass = (type, id) => {
    focus.current = true;
    setTarget({ type, id });
  };
  const group =
    target.type === 'group'
      ? draft.groups.find((item) => item.id === target.id)
      : undefined;
  const direction = draft.directions.find(
    (item) =>
      item.id ===
      (group?.directionId ?? (target.type === 'direction' ? target.id : '')),
  );

  return (
    <section
      className={`card ${styles['class-workspace']}`}
      aria-label="Занятия"
    >
      {(!!direction || !!group || reviewing) && (
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            if (group) {
              open('direction', group.directionId);
            } else {
              open('direction', '');
              setReviewing(false);
            }
          }}
        >
          {group && direction
            ? `К направлению «${direction.name}»`
            : 'Все направления'}
        </button>
      )}
      <h2 id="class-directions" tabIndex={-1}>
        {group
          ? `${direction?.name ?? 'Группа'} → ${group.name || 'Занятие'}`
          : (direction?.name ?? (reviewing ? 'Старое расписание' : 'Занятия'))}
      </h2>
      {group ? (
        <ClassGroupEditor
          key={group.id}
          {...props}
          groupId={group.id}
          open={open}
        />
      ) : direction ? (
        <ClassDirectionEditor
          key={direction.id}
          {...props}
          directionId={direction.id}
          open={open}
        />
      ) : (
        <ClassDirectionList
          {...props}
          reviewing={reviewing}
          review={() => setReviewing(true)}
          open={open}
        />
      )}
    </section>
  );
}
