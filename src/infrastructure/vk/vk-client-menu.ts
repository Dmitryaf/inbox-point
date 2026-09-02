import {
  addressButton,
  ClientInformationCatalog,
  type ClientInformationResolver,
  faqButton,
  pricesButton,
  scheduleButton,
  teacherButton,
} from '@/core/application/client-information.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';

import type { VkGateway, VkKeyboard } from './vk-api-client.js';
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
  ) {}

  public async handle(message: VkMenuMessage): Promise<boolean> {
    const activeRequest = this.repository.findActiveRequest(
      'vk',
      String(message.peerId),
    );
    const response = resolveMenuResponse(
      message.text,
      Boolean(activeRequest),
      this.information,
    );
    if (!response) return false;

    const claimed = this.repository.claimEvent(
      'vk:menu',
      message.externalEventId,
      new Date(),
    );
    if (!claimed) return true;

    try {
      await this.gateway.sendMessage(
        message.peerId,
        response,
        createVkRandomId('vk-menu:' + message.externalEventId),
        createVkMainKeyboard(this.information),
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
): VkKeyboard {
  const customRows = information
    .getCustomSections()
    .map((section, index) => [createButton(section.label, 'custom-' + index)]);
  return {
    buttons: [
      [
        createButton(scheduleButton, 'schedule'),
        createButton(pricesButton, 'prices'),
      ],
      [createButton(addressButton, 'address'), createButton(faqButton, 'faq')],
      ...customRows,
      [createButton(teacherButton, 'teacher', 'primary')],
    ],
    inline: false,
    one_time: false,
  };
}

function resolveMenuResponse(
  text: string,
  hasActiveRequest: boolean,
  informationResolver: ClientInformationResolver,
): string | undefined {
  const normalized = text.trim();
  const information = informationResolver.resolve(normalized);
  if (information) return information;

  if (normalized === teacherButton) {
    return hasActiveRequest
      ? 'Напишите сообщение, и преподаватель получит его в текущем разговоре.'
      : 'Напишите свой вопрос одним сообщением. Преподаватель ответит вам здесь.';
  }
  const command = normalized.toLowerCase();
  if (command === '/start' || command === '/menu' || command === 'начать') {
    return hasActiveRequest
      ? 'У вас уже есть открытый вопрос. Напишите сообщение или выберите нужный раздел.'
      : 'Здравствуйте! Выберите нужный раздел или задайте вопрос преподавателю.';
  }
  if (command.startsWith('/')) {
    return hasActiveRequest
      ? 'Просто напишите сообщение преподавателю или выберите нужный раздел.'
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
