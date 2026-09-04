import type { SupportRepository } from '@/core/contracts/support-repository.js';
import {
  ClientInformationCatalog,
  type ClientInformationResolver,
  newQuestionButton,
  teacherButton,
} from '@/core/application/client-information.js';

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

export class TelegramClientMenu implements TelegramClientMenuHandler {
  public constructor(
    private readonly gateway: TelegramGateway,
    private readonly repository: SupportRepository,
    private readonly operatorChatId: number,
    private readonly information: ClientInformationResolver = new ClientInformationCatalog(),
  ) {}

  public async handle(message: TelegramMenuMessage): Promise<boolean> {
    const conversationId = String(message.chatId);
    const activeRequest = this.repository.findActiveRequest(
      'telegram',
      conversationId,
    );
    const response = resolveMenuResponse(
      message.text,
      Boolean(activeRequest),
      this.information,
    );
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
  information: ClientInformationResolver,
): MenuResponse | undefined {
  const normalized = text.trim();
  const command = parseCommand(normalized);
  const mainMenu = createMainMenu(information);
  const informationResponse = information.resolve(normalized);
  if (informationResponse) {
    return {
      replyMarkup: mainMenu,
      text: informationResponse,
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

function createMainMenu(
  information: ClientInformationResolver,
): TelegramReplyKeyboard {
  const informationRows = createButtonRows(
    information.getInformationButtons().map((text) => ({ text })),
  );
  const customButtons = information
    .getCustomSections()
    .map((section) => ({ text: section.label }));
  const customRows = createButtonRows(customButtons);
  return {
    input_field_placeholder: 'Выберите действие',
    is_persistent: true,
    keyboard: [
      ...informationRows,
      ...customRows,
      [{ text: teacherButton }],
      [{ text: newQuestionButton }],
    ],
    resize_keyboard: true,
  };
}

function createButtonRows(
  buttons: readonly { text: string }[],
): { text: string }[][] {
  const rows: { text: string }[][] = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return rows;
}

function parseCommand(text: string): string | undefined {
  return text.trim().split(/\s+/, 1)[0]?.split('@', 1)[0]?.toLowerCase();
}
