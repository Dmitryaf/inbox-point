import type { SupportRepository } from '@/core/contracts/support-repository.js';

import type {
  TelegramGateway,
  TelegramReplyKeyboard,
  TelegramReplyMarkup,
} from './telegram-api-client.js';
import { isUnavailableForumTopicError } from './telegram-api-client.js';

export interface TelegramMenuMessage {
  chatId: number;
  externalEventId: string;
  text: string;
}

export interface TelegramClientMenuHandler {
  handle(message: TelegramMenuMessage): Promise<boolean>;
}

const scheduleButton = 'Расписание';
const pricesButton = 'Цены';
const addressButton = 'Адрес';
const teacherButton = 'Задать вопрос преподавателю';
const newQuestionButton = 'Начать новый вопрос';

const mainMenu: TelegramReplyKeyboard = {
  input_field_placeholder: 'Выберите действие',
  is_persistent: true,
  keyboard: [
    [{ text: scheduleButton }, { text: pricesButton }],
    [{ text: addressButton }],
    [{ text: teacherButton }],
    [{ text: newQuestionButton }],
  ],
  resize_keyboard: true,
};

export class TelegramClientMenu implements TelegramClientMenuHandler {
  public constructor(
    private readonly gateway: TelegramGateway,
    private readonly repository: SupportRepository,
    private readonly operatorChatId: number,
  ) {}

  public async handle(message: TelegramMenuMessage): Promise<boolean> {
    const conversationId = String(message.chatId);
    const activeRequest = this.repository.findActiveRequest(
      'telegram',
      conversationId,
    );
    const response = resolveMenuResponse(message.text, Boolean(activeRequest));
    if (!response) {
      return false;
    }

    const claimed = this.repository.claimEvent(
      'telegram:menu',
      message.externalEventId,
      new Date(),
    );
    if (!claimed) {
      return true;
    }

    try {
      if (response.resetActiveRequest && activeRequest) {
        try {
          await this.gateway.closeForumTopic(
            this.operatorChatId,
            Number(activeRequest.operatorTopicId),
          );
        } catch (error: unknown) {
          if (!isUnavailableForumTopicError(error)) {
            throw error;
          }
        }
        this.repository.closeRequest(activeRequest.id, new Date());
      }
      await this.gateway.sendMessage({
        chatId: message.chatId,
        replyMarkup: response.replyMarkup,
        text: response.text,
      });
      return true;
    } catch (error: unknown) {
      this.repository.releaseEvent('telegram:menu', message.externalEventId);
      throw error;
    }
  }
}

interface MenuResponse {
  replyMarkup: TelegramReplyMarkup;
  resetActiveRequest?: true;
  text: string;
}

function resolveMenuResponse(
  text: string,
  hasActiveRequest: boolean,
): MenuResponse | undefined {
  const normalized = text.trim();
  const command = parseCommand(normalized);

  if (normalized === scheduleButton) {
    return {
      replyMarkup: mainMenu,
      text: 'Расписание пока не добавлено. Вы можете задать вопрос преподавателю.',
    };
  }
  if (normalized === pricesButton) {
    return {
      replyMarkup: mainMenu,
      text: 'Цены пока не добавлены. Вы можете задать вопрос преподавателю.',
    };
  }
  if (normalized === addressButton) {
    return {
      replyMarkup: mainMenu,
      text: 'Адрес пока не добавлен. Вы можете задать вопрос преподавателю.',
    };
  }

  if (hasActiveRequest) {
    if (command === '/start' || command === '/menu') {
      return {
        replyMarkup: mainMenu,
        text: 'У вас уже есть открытый вопрос. Напишите сообщение, чтобы продолжить разговор, или выберите нужный раздел.',
      };
    }
    if (normalized === teacherButton) {
      return {
        replyMarkup: mainMenu,
        text: 'Напишите сообщение, и преподаватель получит его в текущем разговоре.',
      };
    }
    if (normalized === newQuestionButton) {
      return {
        replyMarkup: mainMenu,
        resetActiveRequest: true,
        text: 'Предыдущий разговор завершён. Выберите нужный раздел.',
      };
    }
    if (command?.startsWith('/')) {
      return {
        replyMarkup: mainMenu,
        text: 'Эта команда недоступна во время разговора. Просто напишите сообщение преподавателю.',
      };
    }
    return undefined;
  }

  if (normalized === newQuestionButton) {
    return {
      replyMarkup: mainMenu,
      text: 'Выберите нужный раздел.',
    };
  }
  if (command === '/start' || command === '/menu') {
    return {
      replyMarkup: mainMenu,
      text: [
        'Здравствуйте! Я помогу быстро найти основную информацию.',
        '',
        'Выберите нужный раздел или задайте вопрос преподавателю.',
      ].join('\n'),
    };
  }
  if (command?.startsWith('/')) {
    return {
      replyMarkup: mainMenu,
      text: 'Открытого обращения нет. Выберите нужный раздел в меню.',
    };
  }
  if (normalized === teacherButton) {
    return {
      replyMarkup: mainMenu,
      text: 'Напишите свой вопрос одним сообщением. Преподаватель ответит вам в этом чате.',
    };
  }
  return undefined;
}

function parseCommand(text: string): string | undefined {
  return text.trim().split(/\s+/, 1)[0]?.split('@', 1)[0]?.toLowerCase();
}
