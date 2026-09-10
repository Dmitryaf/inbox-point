import {
  ClientInformationCatalog,
  handoffButton,
  type ClientInformationResolver,
  isAvailableInformationRequest,
  isHandoffRequest,
} from '@/core/application/client-information.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import {
  acceptingClientIntakePolicy,
  type ClientIntakePolicy,
} from '@/core/contracts/client-intake-policy.js';

import type {
  VkGateway,
  VkKeyboard,
  VkKeyboardButton,
} from './vk-api-client.js';
import { createVkRandomId } from './vk-random-id.js';

export interface VkMenuMessage {
  externalEventId: string;
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
    const activeRequest = this.repository.findActiveRequest(
      'vk',
      String(message.peerId),
    );
    const paused = this.intakePolicy.isPaused('vk') && !activeRequest;
    const informationRequested = isAvailableInformationRequest(
      this.information,
      message.text,
    );
    if (paused && !informationRequested) {
      return this.completeWithoutResponse(message.externalEventId);
    }
    const response = resolveMenuResponse(
      message.text,
      Boolean(activeRequest),
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
      const keyboard = createVkMainKeyboard(this.information, paused);
      await this.gateway.sendMessage(
        message.peerId,
        response,
        createVkRandomId('vk-menu:' + message.externalEventId),
        keyboard.buttons.length > 0 ? keyboard : undefined,
      );
      if (informationRequested) {
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

  private completeWithoutResponse(externalEventId: string): boolean {
    const claimed = this.repository.claimEvent(
      'vk:menu',
      externalEventId,
      new Date(),
    );
    if (claimed) {
      this.repository.completeEvent('vk:menu', externalEventId, new Date());
    }
    return true;
  }
}

export function createVkMainKeyboard(
  information: ClientInformationResolver = new ClientInformationCatalog(),
  paused = false,
): VkKeyboard {
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
      ...(paused ? [] : [[createButton(handoffButton, 'handoff', 'primary')]]),
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

function resolveMenuResponse(
  text: string,
  hasActiveRequest: boolean,
  informationResolver: ClientInformationResolver,
): string | undefined {
  const normalized = text.trim();
  const information = informationResolver.resolve(normalized);
  if (information) {
    return information;
  }

  if (isHandoffRequest(normalized)) {
    return hasActiveRequest
      ? 'Просто напишите сообщение, чтобы продолжить разговор.'
      : 'Напишите свой вопрос. Мы ответим здесь.';
  }
  const command = normalized.toLowerCase();
  if (command === '/start' || command === '/menu' || command === 'начать') {
    return hasActiveRequest
      ? 'Разговор уже начат. Напишите сообщение, чтобы продолжить, или выберите нужный раздел.'
      : 'Здравствуйте! Здесь можно посмотреть основную информацию или задать вопрос.';
  }
  if (command.startsWith('/')) {
    return hasActiveRequest
      ? 'Просто напишите сообщение или выберите нужный раздел.'
      : 'Выберите нужный раздел.';
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
