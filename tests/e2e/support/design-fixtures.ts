import type { OperationsStatus } from '@/modules/operations-monitoring/model/operations-status.js';

// Fictional owner content and conversations; no credentials or real clients.
export const designContent = {
  address: 'Учебный адрес: ул. Примерная, 10, зал 2. Вход со двора.',
  customSections: [
    {
      label: 'Первое занятие',
      text: 'Возьмите удобную одежду, сменную обувь и воду. Приходите за 10 минут.',
    },
  ],
  faq: [
    {
      question: 'Можно без опыта?',
      answer: 'Да, начните с группы для новичков.',
    },
    {
      question: 'Как записаться?',
      answer: 'Напишите удобный день и направление.',
    },
    {
      question: 'Можно прийти без пары?',
      answer: 'Да, пару подберём на занятии.',
    },
  ],
  prices:
    'Пробное занятие — 500 ₽.\nРазовое — 900 ₽.\nАбонемент на 8 занятий — 5 600 ₽.',
  schedule: '',
  scheduleItems: [
    {
      dayTime: 'Пн / Ср, 19:00',
      description:
        'Группа для начинающих: базовые шаги, музыкальность и практика в парах.',
      title: 'Бачата с нуля',
    },
    { dayTime: 'Вт / Чт, 20:00', title: 'Сальса — продолжающие' },
    { dayTime: 'Сб, 12:00', title: 'Практика для всех групп' },
  ],
  visibleSections: ['schedule', 'prices', 'address', 'faq'],
};

const runningChannel = {
  configured: true,
  lastSuccessfulPollAt: '2026-10-04T12:00:59.000Z',
  running: true,
  source: 'local',
  state: 'running',
} as const;

export const attentionOperations: OperationsStatus = {
  channels: { telegram: runningChannel, vk: runningChannel },
  deliveries: {
    failed: 1,
    incidents: [
      {
        attempts: 5,
        channel: 'VK',
        createdAt: '2026-10-04T11:58:00.000Z',
        id: 'synthetic-delivery',
        displayName: 'Учебный клиент — запись на первое занятие',
        messageText:
          'Приходите в понедельник к 19:00. Возьмите сменную обувь и воду. Адрес: ул. Примерная, 10, вход со двора.',
        operatorTopicId: 'synthetic-topic',
        outcomeUnknown: false,
        reason: 'Учебный пример: ответ не доставлен.',
        requestId: 'synthetic-request',
        retryAllowed: true,
      },
    ],
    oldestPendingAgeSeconds: 30,
    oldestPendingAt: '2026-10-04T12:00:30.000Z',
    pending: 3,
    state: 'failed',
    uncertain: 0,
    worker: {
      lastCycleAt: '2026-10-04T12:00:59.000Z',
      running: true,
      state: 'running',
    },
  },
  inboundEvents: { incidents: [], quarantined: 0, state: 'healthy' },
  intake: { telegram: { mode: 'active' }, vk: { mode: 'active' } },
  observedAt: '2026-10-04T12:01:00.000Z',
  operatorInbox: {
    recoverableWebRequests: 0,
    state: 'healthy',
    webOwnedRequests: 0,
  },
  operatorRelays: { incidents: [], state: 'healthy', uncertain: 0 },
  outbound: { mode: 'active' },
  startedAt: '2026-10-04T08:01:00.000Z',
  state: 'attention',
  uptimeSeconds: 14_400,
};

export const designRequests = Array.from({ length: 8 }, (_, index) => ({
  channel: index % 2 === 0 ? 'vk' : 'telegram',
  createdAt: '2026-10-04T11:50:00.000Z',
  displayName:
    index === 0
      ? 'Александра — запись на вечернее занятие для начинающих'
      : `Учебный клиент ${index + 1}`,
  id: `synthetic-request-${index}`,
  latestMessageAt: '2026-10-04T12:00:00.000Z',
  status: 'active',
}));

export function designMessages(requestId: string) {
  return Array.from({ length: 24 }, (_, index) => ({
    createdAt: '2026-10-04T12:00:00.000Z',
    direction: index % 2 === 0 ? 'client_to_operator' : 'operator_to_client',
    id: `${requestId}-message-${index}`,
    senderName: 'Учебный клиент',
    text:
      index % 2 === 0
        ? 'Хочу записаться на вечернее занятие. Подскажите, можно ли прийти без опыта и без пары? '.repeat(
            3,
          )
        : 'Да, начните с группы для новичков. Возьмите удобную одежду и сменную обувь.',
    ...(index % 2 === 0 ? {} : { deliveryStatus: 'sent' }),
  }));
}

export const emergencyOperations: OperationsStatus = {
  ...attentionOperations,
  operatorInbox: {
    ...attentionOperations.operatorInbox,
    webOwnedRequests: designRequests.length,
  },
};
