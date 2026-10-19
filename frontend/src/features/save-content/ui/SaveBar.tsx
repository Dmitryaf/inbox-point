import styles from '@frontend/features/save-content/styles/save-bar.module.css';

export function SaveBar({
  dirty,
  saving,
  restoring = false,
  validationMessage,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  restoring?: boolean;
  validationMessage: string;
  onSave: () => void;
}) {
  const status = restoring
    ? 'Восстанавливаем…'
    : saving
      ? 'Сохраняем изменения…'
      : validationMessage ||
        (dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены');
  return (
    <div className={styles['save-bar']}>
      <div>
        <span className={styles['save-bar-label']}>
          Сохранятся изменения во всех разделах
        </span>
        <p className={dirty ? styles.changed : undefined} role="status">
          {status}
        </p>
      </div>
      <button
        aria-busy={saving}
        disabled={saving || restoring || !dirty}
        type="button"
        onClick={onSave}
      >
        Сохранить
      </button>
    </div>
  );
}
