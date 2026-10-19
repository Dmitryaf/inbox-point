import type { CustomSection } from '@frontend-common/entities/content/model/types';
import styles from '@frontend/entities/content/styles/custom-section-purpose.module.css';

export function CustomSectionPurpose({
  name,
  mode,
  change,
}: {
  name: string;
  mode: CustomSection['mode'];
  change: (mode: 'information' | 'application') => void;
}) {
  const purposes = [
    {
      value: 'information',
      label: 'Показать информацию',
      description:
        'Например: «Цены», «Адрес», «Что взять с собой». Нажав кнопку, человек получит готовый ответ.',
    },
    {
      value: 'application',
      label: 'Принять заявку',
      description:
        'Например: «Заказать звонок». Бот спросит нужные детали и передаст ответ администратору.',
    },
  ] as const;
  return (
    <div
      className={styles['section-purpose']}
      role="radiogroup"
      aria-labelledby={`${name}-label`}
    >
      <p id={`${name}-label`} className={styles['purpose-title']}>
        Для чего нужна кнопка?
      </p>
      {purposes.map((purpose) => (
        <label key={purpose.value} className={styles['purpose-option']}>
          <input
            type="radio"
            name={name}
            value={purpose.value}
            checked={(mode ?? 'information') === purpose.value}
            onChange={() => change(purpose.value)}
          />
          <span>
            <strong>{purpose.label}</strong>
            <span>{purpose.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
