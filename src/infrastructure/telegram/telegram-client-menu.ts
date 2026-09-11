import type { SupportRepository } from '@/core/contracts/support-repository.js';
import {
  acceptingClientIntakePolicy,
  pausedClientIntakeMessage,
  type ClientIntakePolicy,
} from '@/core/contracts/client-intake-policy.js';
import {
  ClientInformationCatalog,
  handoffButton,
  type ClientInformationResolver,
  isAvailableInformationRequest,
  isHandoffRequest,
  newQuestionButton,
} from '@/core/application/client-information.js';
import { isWebOperatorTopic } from '@/core/model/operator-topic.js';

import type {
  TelegramGateway,
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
    private readonly intakePolicy: ClientIntakePolicy = acceptingClientIntakePolicy,
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
      this.intakePolicy,
    );
    const informationRequested = isAvailableInformationRequest(
      this.information,
      message.text,
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
        if (!isWebOperatorTopic(activeRequest.operatorTopicId)) {
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
        }
        this.repository.closeRequest(activeRequest.id, new Date());
      }
      await this.gateway.sendMessage({
        chatId: message.chatId,
        replyMarkup: response.replyMarkup,
        text: response.text,
      });
      if (informationRequested) {
        this.repository.recordUsageEvent({
          channel: 'telegram',
          id: `information:telegram:${message.externalEventId}`,
          occurredAt: new Date(),
          type: 'information_section',
        });
      }
      this.repository.completeEvent(
        'telegram:menu',
        message.externalEventId,
        new Date(),
      );
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
  intakePolicy: ClientIntakePolicy,
): MenuResponse | undefined {
  const normalized = text.trim();
  const command = parseCommand(normalized);
  const paused = intakePolicy.isPaused('telegram');
  const mainMenu = createTelegramMainKeyboard(
    information,
    hasActiveRequest,
    paused,
  );
  const informationResponse = information.resolve(normalized);
  if (
    informationResponse &&
    (!paused ||
      hasActiveRequest ||
      isAvailableInformationRequest(information, normalized))
  ) {
    return {
      replyMarkup: mainMenu,
      text: informationResponse,
    };
  }

  if (paused && !hasActiveRequest) {
    return {
      replyMarkup: mainMenu,
      text: pausedClientIntakeMessage,
    };
  }

  if (hasActiveRequest) {
    if (command === '/start' || command === '/menu') {
      return {
        replyMarkup: mainMenu,
        text: 'Разговор уже начат. Напишите сообщение, чтобы продолжить, или выберите нужный раздел.',
      };
    }
    if (isHandoffRequest(normalized)) {
      return {
        replyMarkup: mainMenu,
        text: 'Просто напишите сообщение, чтобы продолжить разговор.',
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
        text: 'Эта команда недоступна во время разговора. Просто напишите сообщение.',
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
      text: 'Здравствуйте! Здесь можно посмотреть основную информацию или задать вопрос.',
    };
  }
  if (command?.startsWith('/')) {
    return {
      replyMarkup: mainMenu,
      text: 'Открытого обращения нет. Выберите нужный раздел в меню.',
    };
  }
  if (isHandoffRequest(normalized)) {
    return {
      replyMarkup: mainMenu,
      text: 'Напишите свой вопрос. Мы ответим здесь.',
    };
  }
  return undefined;
}

export function createTelegramMainKeyboard(
  information: ClientInformationResolver,
  hasActiveRequest: boolean,
  paused = false,
): TelegramReplyMarkup {
  const informationRows = createButtonRows(
    information.getInformationButtons().map((text) => ({ text })),
  );
  const customButtons = information
    .getCustomSections()
    .map((section) => ({ text: section.label }));
  const customRows = createButtonRows(customButtons);
  let actionRows: { text: string }[][] = [];
  if (hasActiveRequest) {
    actionRows = [[{ text: newQuestionButton }]];
  } else if (!paused) {
    actionRows = [[{ text: handoffButton }]];
  }
  const keyboard = [...informationRows, ...customRows, ...actionRows];
  if (keyboard.length === 0) {
    return { remove_keyboard: true };
  }
  return {
    input_field_placeholder: 'Выберите действие',
    is_persistent: true,
    keyboard,
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
