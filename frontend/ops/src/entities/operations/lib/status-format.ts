import type { ConnectionSource } from '@ops/entities/operations/model/types';

export function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) {
    return `${days} дн. ${hours} ч.`;
  }
  if (hours > 0) {
    return `${hours} ч. ${minutes} мин.`;
  }
  return `${minutes} мин.`;
}

export function connectionSourceLabel(source: ConnectionSource): string {
  if (source === 'environment') {
    return 'Настроен на сервере';
  }
  if (source === 'local') {
    return 'Подключён через настройку';
  }
  return 'Не настроен';
}

export function formatStatusTime(value: string | undefined): string {
  if (!value) {
    return 'Ещё не было';
  }
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value));
}
