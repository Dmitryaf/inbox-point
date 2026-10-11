import type { EnrollmentConfirmationStatus } from '@/core/contracts/class-enrollment-store.js';
import type { TelegramUpdate } from './telegram-types.js';
import type { TelegramGateway } from './telegram-api-client.js';
import { TelegramCallbackExpiredError } from './telegram-api-client.js';

export interface TelegramEnrollmentHandler {
  handleEnrollmentConfirmation?(
    enrollmentId: string,
    topicId: string,
    messageId: string,
  ): Promise<EnrollmentConfirmationStatus>;
}
const notices: Record<EnrollmentConfirmationStatus, string> = {
  pending: 'Подтверждение отправляется клиенту.',
  sent: 'Подтверждение уже отправлено.',
  failed: 'Не удалось отправить подтверждение. Проверьте ошибку доставки.',
  unavailable: 'Эта запись больше недоступна для подтверждения.',
};

export async function handleEnrollmentCallback(
  callback: NonNullable<TelegramUpdate['callback_query']>,
  operatorChatId: number,
  handler: TelegramEnrollmentHandler,
  gateway?: Pick<TelegramGateway, 'answerCallbackQuery'>,
): Promise<boolean> {
  if (!callback.data?.startsWith('enroll:')) {
    return false;
  }
  const message = callback.message;
  const id = callback.data.slice(7);
  const valid =
    message?.chat.id === operatorChatId &&
    message.chat.type === 'supergroup' &&
    message.message_thread_id !== undefined &&
    !callback.from.is_bot &&
    /^[A-Za-z0-9_-]{1,36}$/u.test(id);
  const status =
    valid && handler.handleEnrollmentConfirmation
      ? await handler.handleEnrollmentConfirmation(
          id,
          String(message.message_thread_id),
          String(message.message_id),
        )
      : 'unavailable';
  try {
    await gateway?.answerCallbackQuery?.(callback.id, notices[status]);
  } catch (error: unknown) {
    if (!(error instanceof TelegramCallbackExpiredError)) {
      throw error;
    }
  }
  return true;
}
