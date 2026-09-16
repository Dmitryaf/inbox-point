import {
  ClientInformationCatalog,
  handoffButton,
  type ClientInformationResolver,
  isHandoffRequest,
  newQuestionButton,
} from '@/core/application/client-information.js';
import { resolveClientConversationState } from '@/core/application/client-conversation-state.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import {
  acceptingClientIntakePolicy,
  pausedClientIntakeMessage,
  type ClientIntakePolicy,
} from '@/core/contracts/client-intake-policy.js';
import type { ClientConversationState } from '@/core/model/client-conversation.js';

import type {
  VkGateway,
  VkKeyboard,
  VkKeyboardButton,
} from './vk-api-client.js';
import { createVkRandomId } from './vk-random-id.js';

export interface VkMenuMessage {
  externalEventId: string;
  payload?: string;
  peerId: number;
  text: string;
}

export interface VkClientMenuHandler {
  handle(message: VkMenuMessage): Promise<boolean>;
}

export class VkClientMenu implements VkClientMenuHandler {
  public constructor(
    private readonly gateway: VkGateway,
    private readonly repository: SupportRepository,
    private readonly information: ClientInformationResolver = new ClientInformationCatalog(),
    private readonly intakePolicy: ClientIntakePolicy = acceptingClientIntakePolicy,
  ) {}

  public async handle(message: VkMenuMessage): Promise<boolean> {
    const conversationId = String(message.peerId);
    const state = resolveClientConversationState(
      this.repository,
      this.intakePolicy,
      'vk',
      conversationId,
    );
    const response = resolveMenuResponse(
      message.text,
      message.payload,
      state,
      this.information,
    );
    if (!response) {
      return false;
    }

    const claimed = this.repository.claimEvent(
      'vk:menu',
      message.externalEventId,
      new Date(),
    );
    if (!claimed) {
      return true;
    }

    try {
      if (response.cancelAwaitingQuestion) {
        this.repository.clearAwaitingClientQuestion('vk', conversationId);
      }
      if (response.beginQuestion) {
        this.repository.setAwaitingClientQuestion(
          'vk',
          conversationId,
          new Date(),
        );
      }
      const responseState: ClientConversationState = response.beginQuestion
        ? { intakePaused: false, stage: 'awaiting_question' }
        : response.cancelAwaitingQuestion
          ? resolveClientConversationState(
              this.repository,
              this.intakePolicy,
              'vk',
              conversationId,
            )
          : state;
      const keyboard = createVkMainKeyboard(this.information, responseState);
      await this.gateway.sendMessage(
        message.peerId,
        response.text,
        createVkRandomId('vk-menu:' + message.externalEventId),
        keyboard,
      );
      if (response.informationRequested) {
        this.repository.recordUsageEvent({
          channel: 'vk',
          id: `information:vk:${message.externalEventId}`,
          occurredAt: new Date(),
          type: 'information_section',
        });
      }
      this.repository.completeEvent(
        'vk:menu',
        message.externalEventId,
        new Date(),
      );
      return true;
    } catch (error: unknown) {
      this.repository.releaseEvent('vk:menu', message.externalEventId);
      throw error;
    }
  }
}

export function createVkMainKeyboard(
  information: ClientInformationResolver = new ClientInformationCatalog(),
  state: ClientConversationState = {
    intakePaused: false,
    stage: 'first_contact',
  },
): VkKeyboard {
  if (state.stage === 'awaiting_question') {
    return { buttons: [], inline: false, one_time: false };
  }
  const informationButtons = information
    .getInformationButtons()
    .map((label, index) => createButton(label, 'information-' + index));
  const informationRows = createButtonRows(informationButtons);
  const customRows = information
    .getCustomSections()
    .map((section, index) => [createButton(section.label, 'custom-' + index)]);
  return {
    buttons: [
      ...informationRows,
      ...customRows,
      ...(state.stage === 'active' || state.intakePaused
        ? []
        : [[createButton(handoffButton, 'handoff', 'primary')]]),
    ],
    inline: false,
    one_time: false,
  };
}

function createButtonRows(
  buttons: readonly VkKeyboardButton[],
): VkKeyboardButton[][] {
  const rows: VkKeyboardButton[][] = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return rows;
}

interface VkMenuResponse {
  beginQuestion?: true;
  cancelAwaitingQuestion?: true;
  informationRequested?: true;
  text: string;
}

function resolveMenuResponse(
  text: string,
  payload: string | undefined,
  state: ClientConversationState,
  informationResolver: ClientInformationResolver,
): VkMenuResponse | undefined {
  const normalized = text.trim();
  const menuAction = parseMenuAction(payload);
  const command = normalized.toLowerCase();

  if (state.stage === 'active') {
    if (
      menuAction?.startsWith('information-') ||
      menuAction?.startsWith('custom-')
    ) {
      return resolveStructuredInformation(normalized, informationResolver);
    }
    if (menuAction === 'handoff') {
      return { text: 'Просто напишите сообщение, чтобы продолжить разговор.' };
    }
    if (command === '/start' || command === '/menu' || command === 'начать') {
      return {
        text: 'Разговор уже начат. Напишите сообщение, чтобы продолжить.',
      };
    }
    if (command.startsWith('/')) {
      return {
        text: 'Эта команда недоступна во время разговора. Просто напишите сообщение.',
      };
    }
    return undefined;
  }

  if (
    state.stage === 'awaiting_question' &&
    (command === '/start' || command === '/menu' || command === 'начать')
  ) {
    return {
      cancelAwaitingQuestion: true,
      text: state.intakePaused
        ? pausedClientIntakeMessage
        : 'Здравствуйте! Здесь можно посмотреть основную информацию или задать вопрос.',
    };
  }

  if (
    menuAction?.startsWith('information-') ||
    menuAction?.startsWith('custom-')
  ) {
    const information = resolveStructuredInformation(
      normalized,
      informationResolver,
    );
    if (information) {
      return information;
    }
  }

  if (state.intakePaused) {
    return { text: pausedClientIntakeMessage };
  }

  if (state.stage === 'awaiting_question') {
    if (
      menuAction === 'handoff' ||
      isHandoffRequest(normalized) ||
      normalized === newQuestionButton
    ) {
      return createQuestionPrompt();
    }
    if (!command.startsWith('/')) {
      return undefined;
    }
  }

  if (
    menuAction === 'handoff' ||
    isHandoffRequest(normalized) ||
    normalized === newQuestionButton
  ) {
    return createQuestionPrompt();
  }
  if (command === '/start' || command === '/menu' || command === 'начать') {
    return {
      text: 'Здравствуйте! Здесь можно посмотреть основную информацию или задать вопрос.',
    };
  }
  if (command.startsWith('/')) {
    return { text: 'Открытого обращения нет. Выберите нужный раздел в меню.' };
  }
  if (state.stage === 'closed') {
    return {
      text: 'Предыдущий разговор завершён. Если хотите задать новый вопрос, нажмите «Задать вопрос».',
    };
  }
  return undefined;
}

function createQuestionPrompt(): VkMenuResponse {
  return {
    beginQuestion: true,
    text: 'Напишите свой вопрос. Мы ответим здесь.',
  };
}

function resolveStructuredInformation(
  text: string,
  information: ClientInformationResolver,
): VkMenuResponse | undefined {
  const resolved = information.resolve(text);
  if (resolved) {
    return { informationRequested: true, text: resolved };
  }
  if (information.isStaleMenuAction(text)) {
    return { text: 'Меню обновилось. Выберите нужный раздел ниже.' };
  }
  return undefined;
}

function parseMenuAction(payload: string | undefined): string | undefined {
  if (!payload) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(payload);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'action' in parsed &&
      typeof parsed.action === 'string'
    ) {
      return parsed.action;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function createButton(
  label: string,
  action: string,
  color: 'primary' | 'secondary' = 'secondary',
) {
  return {
    action: {
      label,
      payload: JSON.stringify({ action }),
      type: 'text' as const,
    },
    color,
  };
}
