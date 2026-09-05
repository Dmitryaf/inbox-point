import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import type {
  DeliverySummary,
  SupportRepository,
} from '@/core/contracts/support-repository.js';
import type { FailedDelivery } from '@/core/model/support-request.js';
import type { SqliteBackupService } from '@/infrastructure/persistence/sqlite-backup-service.js';
import type { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';
import type { VkSetupController } from '@/infrastructure/vk/vk-setup-controller.js';
import { loadFrontendAssets, type FrontendAssets } from './frontend-assets.js';

export function createApp(config: RuntimeConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  app.get('/health', () => ({ status: 'ok' }));

  return app;
}

const tokenSchema = z.object({ botToken: z.string().min(20).max(200) });
const connectSchema = tokenSchema.extend({
  operatorChatId: z.number().int().safe().negative(),
});
const deliveryRetrySchema = z.object({
  deliveryId: z.string().min(1).max(100),
});
const vkConnectSchema = z.object({
  accessToken: z.string().min(20).max(500),
  community: z.string().trim().min(1).max(300),
});

export function registerSetupRoutes(
  app: FastifyInstance,
  setup: TelegramSetupController,
  deliveries?: Pick<
    SupportRepository,
    'findFailedDeliveries' | 'getDeliverySummary' | 'retryFailedDelivery'
  >,
  backups?: Pick<SqliteBackupService, 'createBackup'>,
  vkSetup?: VkSetupController,
  options: { assets?: FrontendAssets; enabled: boolean } = { enabled: true },
): void {
  let assets = options.assets;

  function getAssets(): FrontendAssets {
    assets ??= loadFrontendAssets('/setup');
    return assets;
  }

  app.addHook('onRequest', async (request, reply) => {
    if (
      isSetupUrl(request.url) &&
      (!options.enabled || !isLoopback(request.ip))
    ) {
      await reply.code(404).send({ message: 'Not found' });
    }
  });
  app.addHook('onSend', async (request, reply, payload) => {
    if (isSetupUrl(request.url)) {
      void reply.header('cache-control', 'no-store');
      void reply.header('x-content-type-options', 'nosniff');
      void reply.header('x-frame-options', 'DENY');
    }
    return payload;
  });
  app.get('/setup', async (_request, reply) => {
    void reply.header(
      'content-security-policy',
      [
        `default-src 'none'`,
        `script-src 'self'`,
        `style-src 'self'`,
        `connect-src 'self'`,
        `frame-ancestors 'none'`,
      ].join('; '),
    );
    return reply.type('text/html; charset=utf-8').send(getAssets().html);
  });
  app.get('/setup/app.js', async (_request, reply) =>
    reply
      .type('application/javascript; charset=utf-8')
      .send(getAssets().script),
  );
  app.get('/setup/style.css', async (_request, reply) =>
    reply.type('text/css; charset=utf-8').send(getAssets().styles),
  );
  app.get('/api/setup/status', () => ({
    ...setup.status(),
    vk: vkSetup?.status() ?? {
      connected: false,
      locked: true,
      source: 'none',
    },
  }));
  app.get('/api/setup/deliveries', () =>
    createPublicDeliveryStatus(deliveries),
  );
  app.post('/api/setup/deliveries/retry', async (request, reply) => {
    if (!deliveries) {
      return reply
        .code(503)
        .send({ message: 'Управление доставкой пока недоступно.' });
    }
    const parsed = deliveryRetrySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Не удалось выбрать ответ.' });
    }
    const queued = deliveries.retryFailedDelivery(
      parsed.data.deliveryId,
      new Date(),
    );
    if (!queued) {
      return reply.code(409).send({
        message: 'Ответ уже отправляется или больше не требует повтора.',
      });
    }
    return { queued: true };
  });
  app.post('/api/setup/backups', async (_request, reply) => {
    if (!backups) {
      return reply
        .code(503)
        .send({ message: 'Резервное копирование пока недоступно.' });
    }
    try {
      const created = await backups.createBackup();
      return {
        createdAt: created.createdAt.toISOString(),
        fileName: created.fileName,
      };
    } catch (error: unknown) {
      app.log.error({ err: error }, 'SQLite backup failed');
      return reply.code(500).send({
        message: 'Не удалось создать резервную копию. Попробуйте ещё раз.',
      });
    }
  });
  app.post('/api/setup/telegram/discover', async (request, reply) => {
    const parsed = tokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ message: 'Введите корректный токен бота.' });
    }
    try {
      return { chats: await setup.discover(parsed.data.botToken) };
    } catch (error: unknown) {
      return reply.code(400).send({ message: setupErrorMessage(error) });
    }
  });
  app.post('/api/setup/telegram/connect', async (request, reply) => {
    const parsed = connectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Проверьте токен и группу.' });
    }
    try {
      await setup.connect(parsed.data.botToken, parsed.data.operatorChatId);
      return { connected: true };
    } catch (error: unknown) {
      return reply.code(400).send({ message: setupErrorMessage(error) });
    }
  });
  app.post('/api/setup/vk/connect', async (request, reply) => {
    if (!vkSetup) {
      return reply
        .code(503)
        .send({ message: 'Подключение VK пока недоступно.' });
    }
    const parsed = vkConnectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ message: 'Проверьте ссылку и ключ доступа.' });
    }
    try {
      await vkSetup.connect(parsed.data.accessToken, parsed.data.community);
      return { connected: true };
    } catch (error: unknown) {
      return reply.code(400).send({ message: vkSetupErrorMessage(error) });
    }
  });
}

function createPublicDeliveryStatus(
  deliveries:
    | Pick<SupportRepository, 'findFailedDeliveries' | 'getDeliverySummary'>
    | undefined,
): {
  failures: readonly PublicDeliveryFailure[];
  summary: DeliverySummary;
} {
  if (!deliveries) {
    return {
      failures: [],
      summary: { failed: 0, pending: 0 },
    };
  }
  return {
    failures: deliveries.findFailedDeliveries(20).map(mapDeliveryFailure),
    summary: deliveries.getDeliverySummary(),
  };
}

interface PublicDeliveryFailure {
  attempts: number;
  channel: 'Telegram' | 'VK';
  createdAt: string;
  id: string;
  reason: string;
}

function mapDeliveryFailure(delivery: FailedDelivery): PublicDeliveryFailure {
  return {
    attempts: delivery.attempts,
    channel: delivery.channel === 'telegram' ? 'Telegram' : 'VK',
    createdAt: delivery.createdAt.toISOString(),
    id: delivery.id,
    reason: explainDeliveryFailure(delivery.lastError, delivery.channel),
  };
}

function explainDeliveryFailure(
  error: string,
  channel: FailedDelivery['channel'],
): string {
  const normalized = error.toLowerCase();
  if (
    normalized.includes('blocked') ||
    normalized.includes('chat not found') ||
    normalized.includes('user is deactivated') ||
    normalized.includes('forbidden')
  ) {
    return 'Бот не может написать клиенту. Возможно, клиент заблокировал бота.';
  }
  if (
    normalized.includes('unauthorized') ||
    normalized.includes('invalid token')
  ) {
    return channel === 'telegram'
      ? 'Telegram не принимает подключение бота. Переподключите Telegram.'
      : 'VK не принимает ключ сообщества. Переподключите VK.';
  }
  if (normalized.includes('too many requests') || normalized.includes('429')) {
    return 'Канал временно ограничил отправку. Повторите попытку позже.';
  }
  if (
    normalized.includes('request failed') ||
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('econn')
  ) {
    return 'Не удалось связаться с каналом. Проверьте интернет и повторите попытку.';
  }
  return channel === 'telegram'
    ? 'Telegram не доставил ответ. Проверьте подключение и повторите попытку.'
    : 'VK не доставил ответ. Проверьте подключение и повторите попытку.';
}

function isSetupUrl(url: string): boolean {
  return (
    url === '/setup' ||
    url.startsWith('/setup/') ||
    url.startsWith('/api/setup/')
  );
}

function isLoopback(address: string): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}

function setupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('supergroup') || message.includes('Topics')) {
    return 'Включите в выбранной группе темы и попробуйте снова.';
  }
  if (message.includes('administrator')) {
    return 'Назначьте бота администратором выбранной группы.';
  }
  if (message.includes('can_manage_topics')) {
    return 'Разрешите боту управлять темами группы.';
  }
  if (message.includes('webhook')) {
    return 'У бота уже настроена другая интеграция. Отключите её или создайте отдельного бота.';
  }
  if (message.includes('already connected')) {
    return 'Telegram уже подключён.';
  }
  if (message.includes('managed by server')) {
    return 'Эта настройка управляется сервером.';
  }
  return 'Не удалось подключиться. Проверьте токен, группу и права бота.';
}

function vkSetupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('workspace is not connected')) {
    return 'Сначала подключите Telegram для преподавателей.';
  }
  if (message.includes('does not point to a community')) {
    return 'Укажите ссылку именно на сообщество VK.';
  }
  if (message.includes('already connected')) {
    return 'VK уже подключён.';
  }
  if (message.includes('managed by server')) {
    return 'Эта настройка управляется сервером.';
  }
  if (message.includes('code 15')) {
    return 'Включите Long Poll API в настройках сообщества VK.';
  }
  return 'Не удалось подключить VK. Проверьте ссылку, ключ и права сообщества.';
}
