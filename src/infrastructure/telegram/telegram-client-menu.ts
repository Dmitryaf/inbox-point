import type { SupportRepository } from '@/core/contracts/support-repository.js';
import {
  acceptingClientIntakePolicy,
  pausedClientIntakeMessage,
  type ClientIntakePolicy,
} from '@/core/contracts/client-intake-policy.js';
import { resolveClientConversationState } from '@/core/application/client-conversation-state.js';
import {
  ClientInformationCatalog,
  handoffButton,
  type ClientInformationResolver,
  isHandoffRequest,
  newQuestionButton,
} from '@/core/application/client-information.js';
import type { ClientConversationState } from '@/core/model/client-conversation.js';

import type {
  TelegramGateway,
  TelegramReplyMarkup,
} from './telegram-api-client.js';

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
    private readonly information: ClientInformationResolver = new ClientInformationCatalog(),
    private readonly intakePolicy: ClientIntakePolicy = acceptingClientIntakePolicy,
  ) {}

  public async handle(message: TelegramMenuMessage): Promise<boolean> {
    const conversationId = String(message.chatId);
    const state = resolveClientConversationState(
      this.repository,
      this.intakePolicy,
      'telegram',
      conversationId,
    );
    const response = resolveMenuResponse(message.text, state, this.information);
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
      let replyMarkup = response.replyMarkup;
      if (response.cancelAwaitingQuestion) {
        this.repository.clearAwaitingClientQuestion('telegram', conversationId);
        replyMarkup = createTelegramMainKeyboard(
          this.information,
          resolveClientConversationState(
            this.repository,
            this.intakePolicy,
            'telegram',
            conversationId,
          ),
        );
      }
      if (response.beginQuestion) {
        this.repository.setAwaitingClientQuestion(
          'telegram',
          conversationId,
          new Date(),
        );
      }
      await this.gateway.sendMessage({
        chatId: message.chatId,
        replyMarkup,
        text: response.text,
      });
      if (response.informationRequested) {
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
  beginQuestion?: true;
  cancelAwaitingQuestion?: true;
  informationRequested?: true;
  replyMarkup: TelegramReplyMarkup;
  text: string;
}

function resolveMenuResponse(
  text: string,
  state: ClientConversationState,
  information: ClientInformationResolver,
): MenuResponse | undefined {
  const normalized = text.trim();
  const command = parseCommand(normalized);
  const mainMenu = createTelegramMainKeyboard(information, state);
  const informationResponse = information.resolve(normalized);

  if (state.stage === 'active') {
    if (informationResponse) {
      return {
        replyMarkup: mainMenu,
        informationRequested: true,
        text: informationResponse,
      };
    }
    if (information.isStaleMenuAction(normalized)) {
      return {
        replyMarkup: mainMenu,
        text: 'Меню обновилось. Выберите нужный раздел ниже.',
      };
    }
    if (normalized === newQuestionButton || isHandoffRequest(normalized)) {
      return {
        replyMarkup: mainMenu,
        text: 'Разговор уже начат. Напишите сообщение, чтобы продолжить.',
      };
    }
    if (command === '/start' || command === '/menu') {
      return {
        replyMarkup: mainMenu,
        text: 'Разговор уже начат. Напишите сообщение, чтобы продолжить.',
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

  if (
    state.stage === 'awaiting_question' &&
    (command === '/start' || command === '/menu')
  ) {
    return {
      cancelAwaitingQuestion: true,
      replyMarkup: mainMenu,
      text: state.intakePaused
        ? pausedClientIntakeMessage
        : 'Здравствуйте! Здесь можно посмотреть основную информацию или задать вопрос.',
    };
  }

  if (state.intakePaused) {
    if (informationResponse) {
      return {
        replyMarkup: mainMenu,
        informationRequested: true,
        text: informationResponse,
      };
    }
    if (information.isStaleMenuAction(normalized)) {
      return {
        replyMarkup: mainMenu,
        text: 'Меню обновилось. Выберите нужный раздел ниже.',
      };
    }
    return {
      replyMarkup: mainMenu,
      text: pausedClientIntakeMessage,
    };
  }

  if (state.stage === 'awaiting_question') {
    if (normalized === newQuestionButton || isHandoffRequest(normalized)) {
      return createQuestionPrompt(information);
    }
    if (!command?.startsWith('/')) {
      return undefined;
    }
  }

  if (informationResponse) {
    return {
      replyMarkup: mainMenu,
      informationRequested: true,
      text: informationResponse,
    };
  }

  if (information.isStaleMenuAction(normalized)) {
    return {
      replyMarkup: mainMenu,
      text: 'Меню обновилось. Выберите нужный раздел ниже.',
    };
  }

  if (normalized === newQuestionButton || isHandoffRequest(normalized)) {
    return createQuestionPrompt(information);
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
  if (state.stage === 'closed') {
    return {
      replyMarkup: mainMenu,
      text: 'Предыдущий разговор завершён. Если хотите задать новый вопрос, нажмите «Задать вопрос».',
    };
  }
  return undefined;
}

function createQuestionPrompt(
  information: ClientInformationResolver,
): MenuResponse {
  return {
    beginQuestion: true,
    replyMarkup: createTelegramMainKeyboard(information, {
      intakePaused: false,
      stage: 'awaiting_question',
    }),
    text: 'Напишите свой вопрос. Мы ответим здесь.',
  };
}

export function createTelegramMainKeyboard(
  information: ClientInformationResolver,
  state: ClientConversationState,
): TelegramReplyMarkup {
  if (state.stage === 'awaiting_question') {
    return { remove_keyboard: true };
  }
  const informationRows = createButtonRows(
    information.getInformationButtons().map((text) => ({ text })),
  );
  const customButtons = information
    .getCustomSections()
    .map((section) => ({ text: section.label }));
  const customRows = createButtonRows(customButtons);
  const actionRows = state.intakePaused ? [] : [[{ text: handoffButton }]];
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
