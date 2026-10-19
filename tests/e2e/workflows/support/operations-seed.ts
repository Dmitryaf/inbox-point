import type { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
export function seedOperationsIncidents(
  repository: SqliteSupportRepository,
  now: Date,
) {
  repository.createRequest({
    id: 'incident-request',
    channel: 'vk',
    conversationId: '303',
    createdAt: now,
    displayName: 'Синтетический клиент для проверки инцидентов',
    operatorTopicId: 'topic-303',
    status: 'active',
  });
  for (const id of ['failed', 'unknown']) {
    repository.recordConversationMessage({
      id: `message-${id}`,
      requestId: 'incident-request',
      createdAt: now,
      direction: 'operator_to_client',
      externalMessageId: `operator-${id}`,
      text: `Синтетический ответ ${id}: подробная информация о записи и времени первого занятия.`,
    });
    repository.enqueueDelivery({
      id: `delivery-${id}`,
      idempotencyKey: `seed-${id}`,
      requestId: 'incident-request',
      channel: 'vk',
      conversationId: '303',
      createdAt: now,
      operatorMessageId: `operator-${id}`,
      text: `Синтетический ответ ${id}: подробная информация о записи и времени первого занятия.`,
    });
    if (id === 'failed') {
      repository.markDeliveryFailed(`delivery-${id}`, 'network timeout');
    } else {
      repository.markDeliveryOutcomeUnknown(
        `delivery-${id}`,
        'network timeout',
      );
    }
  }
  repository.prepareOperatorAction({
    id: 'operator:close',
    kind: 'close_request',
    requestId: 'incident-request',
    operatorTopicId: 'topic-303',
    clientMessageId: 'external-close',
    createdAt: now,
    initial: false,
    sequence: 0,
  });
  repository.claimOperatorAction('operator:close', now);
  repository.markOperatorActionOutcomeUnknown(
    'operator:close',
    'synthetic timeout',
  );
  repository.enqueueInboundEvents([
    {
      source: 'telegram:get-updates',
      externalEventId: 'event:1',
      payload: '{}',
      receivedAt: now,
    },
  ]);
  repository.recordInboundEventFailure(
    'telegram:get-updates',
    'event:1',
    'synthetic failure',
    now,
    1,
  );
}
