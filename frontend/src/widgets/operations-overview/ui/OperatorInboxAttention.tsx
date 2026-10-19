import styles from '@frontend/widgets/operations-overview/styles/operator-inbox-attention.module.css';
export function OperatorInboxAttention({
  recoverableRequests,
}: {
  recoverableRequests: number;
}) {
  return (
    <article className={styles['operator-inbox-attention']}>
      <h3>Обращения ждут доставки в Telegram</h3>
      <p>
        Сохранено обращений: {recoverableRequests}. Система повторит доставку
        автоматически.
      </p>
      <p>Пока проверьте входящие обращения ниже.</p>
    </article>
  );
}
