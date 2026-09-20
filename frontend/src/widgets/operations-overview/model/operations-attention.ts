import type {
  ChannelOperationsStatus,
  OperatorActionResolution,
} from '@frontend/entities/operations/model/types';

export interface OperationsAttentionEmits {
  resolveDelivery: [
    deliveryId: string,
    resolution: 'not_received' | 'received',
  ];
  retryDelivery: [deliveryId: string];
  resolveOperatorAction: [
    actionId: string,
    resolution: OperatorActionResolution,
  ];
  resolveInboundEvent: [
    eventId: string,
    source: string,
    resolution: 'retry' | 'skip',
  ];
}

export interface ChannelProblem {
  action: string;
  channel: 'Telegram' | 'VK';
  kind: 'connection' | 'setup';
  name: string;
  summary: string;
}

export function channelProblem(
  name: 'Telegram' | 'VK',
  channel: ChannelOperationsStatus,
): ChannelProblem | undefined {
  if (channel.state === 'running' || channel.state === 'starting') {
    return undefined;
  }
  if (channel.state === 'configuration_missing') {
    return {
      action: `Откройте «Каналы» и подключите ${name} заново.`,
      channel: name,
      kind: 'setup',
      name: `${name} требует подключения`,
      summary:
        'Канал был обязательным для этого экземпляра, но его настройки сейчас недоступны.',
    };
  }
  if (channel.state === 'not_configured') {
    return {
      action:
        name === 'Telegram'
          ? 'Создайте бота и добавьте его в закрытую группу, где сотрудники будут отвечать клиентам.'
          : 'Включите сообщения сообщества и выдайте Inbox Point ключ доступа к ним.',
      channel: name,
      kind: 'setup',
      name: `${name} не подключён`,
      summary: 'Сообщения из этого канала сейчас не принимаются.',
    };
  }
  return {
    action:
      'Обновите состояние. Если связь не восстановилась, проверьте подключение канала.',
    channel: name,
    kind: 'connection',
    name: `Нет связи с ${name}`,
    summary: 'Новые сообщения из этого канала могут не поступать.',
  };
}
