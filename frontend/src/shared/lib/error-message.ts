import { HttpError } from '@frontend/shared/api/http-client';

export function errorMessage(cause: unknown): string {
  return cause instanceof HttpError
    ? cause.message
    : 'Не удалось выполнить действие. Проверьте подключение и попробуйте ещё раз.';
}
