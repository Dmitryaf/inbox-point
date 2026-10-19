import { useState } from 'react';
import { normalizeKeyword } from '@core/application/class-content';
import type { ContentEditorProps } from '@frontend/entities/content/model/editor-props';
import styles from '@frontend/entities/content/styles/class-editor.module.css';

export function ClassDirectionCreate({
  draft,
  edit,
  created,
}: ContentEditorProps & { created: (id: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = name.trim();
    if (
      !title ||
      /[/:\r\n]/u.test(title) ||
      draft.directions.some(
        (item) => normalizeKeyword(item.name) === normalizeKeyword(title),
      )
    ) {
      setNotice('Введите новое название направления, без / и :.');
      return;
    }
    if (draft.directions.length >= 20) {
      return;
    }
    const id = crypto.randomUUID();
    edit({ directions: [...draft.directions, { id, name: title }] });
    setName('');
    setNotice('');
    setAdding(false);
    created(id);
  }
  return !adding ? (
    <button
      type="button"
      disabled={draft.directions.length >= 20}
      onClick={() => setAdding(true)}
    >
      Добавить направление
    </button>
  ) : (
    <form className={styles['class-editor']} onSubmit={add}>
      <label htmlFor="new-direction-name">Новое направление</label>
      <input
        id="new-direction-name"
        value={name}
        maxLength={80}
        placeholder="Например, Бачата"
        onChange={(event) => setName(event.target.value)}
      />
      <div className={styles['class-actions']}>
        <button type="submit">Создать направление</button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setAdding(false)}
        >
          Отмена
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
