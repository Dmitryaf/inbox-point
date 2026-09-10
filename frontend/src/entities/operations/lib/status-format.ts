import type { ConnectionSource } from '@frontend/entities/operations/model/types';
import { formatShortDateTimeWithSeconds } from '@frontend/shared/lib/format-date-time';

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
    return 'Подключён при установке';
  }
  if (source === 'local') {
    return 'Подключён здесь';
  }
  return 'Не настроен';
}

export function formatStatusTime(value: string | undefined): string {
  if (!value) {
    return 'Ещё не было';
  }
  return formatShortDateTimeWithSeconds(value);
}
