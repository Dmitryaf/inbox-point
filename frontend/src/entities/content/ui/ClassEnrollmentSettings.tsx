import { useState } from 'react';
import {
  defaultApplicationQuestion,
  defaultEnrollmentConfirmation,
  type ClassGroup,
} from '@core/application/class-content';
import { classEnrollmentIssue } from '@frontend-common/entities/content/model/class-enrollment';
import type { ContentEditorProps } from '@frontend/entities/content/model/editor-props';
import styles from '@frontend/entities/content/styles/class-editor.module.css';

export function ClassEnrollmentSettings({
  draft,
  group,
  update,
}: ContentEditorProps & {
  group: ClassGroup;
  update: (group: ClassGroup) => void;
}) {
  const [notice, setNotice] = useState('');
  return (
    <section className={styles['class-card']} aria-label="Запись в группу">
      <h3>Запись в группу</h3>
      <label className={styles['class-check']}>
        <input
          type="checkbox"
          checked={group.enrollmentOpen}
          onChange={(event) => {
            const checked = event.target.checked;
            const issue = checked
              ? classEnrollmentIssue(draft, group)
              : undefined;
            setNotice(issue ?? '');
            if (issue) {
              return;
            }
            const next = { ...group, enrollmentOpen: checked };
            if (checked) {
              delete next.review;
            }
            update(next);
          }}
        />
        Открыть набор в группу
      </label>
      {notice && <p role="alert">{notice}</p>}
      <p>
        Включите набор — в карточке этой группы бот покажет кнопку «Записаться
        на занятие». При закрытом наборе этой кнопки нет.
      </p>
      <div hidden={!group.enrollmentOpen}>
        <label htmlFor={`group-question-${group.id}`}>
          Вопрос клиенту для записи
        </label>
        <textarea
          id={`group-question-${group.id}`}
          value={group.applicationQuestion}
          rows={2}
          maxLength={1000}
          placeholder={defaultApplicationQuestion}
          onChange={(event) =>
            update({ ...group, applicationQuestion: event.target.value })
          }
        />
        <p className={styles['class-hint']}>
          После нажатия кнопки бот задаст этот вопрос. Ответ клиента придёт
          администратору вместе с названием группы и кнопкой «Подтвердить
          запись».
        </p>
        <label htmlFor={`group-confirmation-${group.id}`}>
          Ответ после подтверждения записи
        </label>
        <textarea
          id={`group-confirmation-${group.id}`}
          value={group.confirmationText ?? ''}
          rows={3}
          maxLength={1000}
          placeholder={defaultEnrollmentConfirmation}
          onChange={(event) =>
            update({ ...group, confirmationText: event.target.value })
          }
        />
        <p className={styles['class-hint']}>
          Нажав «Подтвердить запись» в Telegram, администратор отправит клиенту
          этот ответ. Если поле пустое, бот отправит: «
          {defaultEnrollmentConfirmation}».
        </p>
      </div>
    </section>
  );
}
