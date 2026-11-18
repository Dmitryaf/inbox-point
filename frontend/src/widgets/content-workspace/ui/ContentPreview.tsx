import { useLayoutEffect, useRef, useState } from 'react';
import type { ContentDraft } from '@frontend-common/entities/content/model/types';
import { clientPreview } from '@frontend-common/entities/content/lib/client-preview';
import {
  addressButton,
  pricesButton,
  scheduleButton,
} from '@core/application/client-information';
import type { OpenClass } from '@frontend/entities/content/model/editor-props';
import {
  ShortAnswerField,
  type InformationProps,
} from '@frontend/entities/content/ui/InformationEditor';
import styles from '@frontend/widgets/content-workspace/styles/content-preview.module.css';
import { PreviewConversation } from './PreviewConversation';

export function ContentPreview({
  draft,
  start,
  editing,
  onEditClass,
}: {
  draft: ContentDraft;
  start: { action: string; sequence: number };
  editing?: Pick<InformationProps, 'edit' | 'issues'>;
  onEditClass?: OpenClass;
}) {
  const [action, setAction] = useState(start.action);
  const heading = useRef<HTMLHeadingElement>(null);
  const moveFocus = useRef(false);
  const [family, operation, targetId] = action.split(':');
  const field =
    action === `reply:${pricesButton}` ||
    (family === 'classes' && operation === 'prices')
      ? 'prices'
      : action === `reply:${addressButton}`
        ? 'address'
        : undefined;
  const inputId = editing && field ? `preview-${field}` : undefined;
  const fieldLabel = field === 'prices' ? pricesButton : addressButton;
  useLayoutEffect(() => {
    if (start.sequence) {
      heading.current?.focus();
    }
  }, [start.sequence]);
  useLayoutEffect(() => {
    if (moveFocus.current) {
      (inputId ? document.getElementById(inputId) : heading.current)?.focus();
      moveFocus.current = false;
    }
  }, [action, inputId]);
  function navigate(next: string) {
    if (next !== action) {
      moveFocus.current = true;
      setAction(next);
    }
  }
  const { response, buttonRows, empty } = clientPreview(draft, action);
  const blankAnswer = editing && field && !draft[field].trim();
  const rows = blankAnswer && family === 'reply' ? [] : buttonRows;
  const classTarget =
    family === 'classes' && targetId && operation === 'direction'
      ? {
          type: 'direction' as const,
          id: targetId,
          label: 'Изменить направление',
        }
      : family === 'classes' &&
          targetId &&
          ['group', 'times', 'signup', 'question'].includes(operation ?? '')
        ? { type: 'group' as const, id: targetId, label: 'Изменить группу' }
        : action === `reply:${scheduleButton}` ||
            (family === 'classes' && !field)
          ? { type: 'direction' as const, id: '', label: 'Изменить расписание' }
          : undefined;
  return (
    <section
      className={`card ${styles.card}`}
      aria-label="Предпросмотр ответов"
    >
      <h2 ref={heading} tabIndex={-1}>
        Предпросмотр ответов
      </h2>
      <p className={styles['preview-intro']}>
        {action === 'main' &&
          (editing
            ? 'Выберите «Цены» или «Адрес», чтобы изменить ответ. '
            : 'Нажимайте кнопки, чтобы пройти путь клиента. ')}
        Сообщения из предпросмотра не отправляются.
      </p>
      <button
        type="button"
        className="secondary-button"
        onClick={() => navigate('main')}
      >
        Начать с меню
      </button>
      {empty && (
        <p className={styles.empty}>
          Заполните разделы — здесь появится будущий ответ.
        </p>
      )}
      <div
        className={`${styles['preview-layout']} ${editing && field ? styles['preview-layout--editing'] : ''}`}
      >
        <PreviewConversation
          response={response}
          rows={rows}
          text={blankAnswer ? 'Текст ответа пока не заполнен.' : response.text}
          navigate={navigate}
        />
        {editing && field && inputId && (
          <div className={styles['preview-editor']}>
            <ShortAnswerField
              {...editing}
              draft={draft}
              field={field}
              inputId={inputId}
              label={`Текст ответа «${fieldLabel}»`}
            />
            <p className={styles['preview-intro']}>
              Этот текст используют Telegram и VK.
            </p>
          </div>
        )}
      </div>
      {onEditClass && classTarget && (
        <button
          type="button"
          className={`secondary-button ${styles['edit-class']}`}
          onClick={() => onEditClass(classTarget.type, classTarget.id)}
        >
          {classTarget.label}
        </button>
      )}
    </section>
  );
}
