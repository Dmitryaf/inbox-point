import type { OperationsStatus } from '@frontend-common/entities/operations/model/types';
import type {
  ClientChannel,
  ServiceControlState,
} from '@frontend-common/entities/service-control/model/types';
import styles from '@frontend/features/control-client-intake/styles/channel-intake-controls.module.css';

export function ChannelIntakeControls({
  channels,
  state,
  pendingChannel,
  onChange,
}: {
  channels: OperationsStatus['channels'];
  state: ServiceControlState;
  pendingChannel: string;
  onChange: (channel: ClientChannel, mode: 'active' | 'paused') => void;
}) {
  return (
    <div className={styles['intake-channel-list']}>
      {(['telegram', 'vk'] as const).map((channel) => {
        const configured = channels[channel].configured;
        const paused = state.channels[channel].mode === 'paused';
        const name = channel === 'telegram' ? 'Telegram' : 'VK';
        const explanation = !configured
          ? `Подключите ${name} в разделе «Каналы».`
          : paused
            ? channel === 'telegram'
              ? 'Бот не передаёт новые обращения администратору и сообщает клиенту о паузе.'
              : 'Новые сообщения остаются в VK, но не появляются у администратора.'
            : channel === 'telegram'
              ? 'Новый вопрос можно задать через бота.'
              : 'Новый вопрос можно задать через сообщество.';
        return (
          <article key={channel}>
            <div>
              <div className={styles['intake-channel-heading']}>
                <strong>{name}</strong>
                <span
                  className={`${styles['intake-status']} ${!configured ? styles['intake-status--disconnected'] : paused ? styles['intake-status--paused'] : ''}`}
                >
                  {!configured
                    ? 'Не подключён'
                    : paused
                      ? 'На паузе'
                      : 'Приём включён'}
                </span>
              </div>
              <p>{explanation}</p>
            </div>
            {configured && (
              <button
                className={paused ? undefined : 'danger'}
                type="button"
                disabled={Boolean(pendingChannel)}
                onClick={() => onChange(channel, paused ? 'active' : 'paused')}
              >
                {pendingChannel === channel
                  ? paused
                    ? 'Возобновляем…'
                    : 'Приостанавливаем…'
                  : paused
                    ? 'Возобновить'
                    : 'Приостановить'}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
