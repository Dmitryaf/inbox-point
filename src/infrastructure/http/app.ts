import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import type { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';
import type { VkSetupController } from '@/infrastructure/vk/vk-setup-controller.js';
import type { AdminRouteAccess } from './admin-route-access.js';
import { loadFrontendAssets, type FrontendAssets } from './frontend-assets.js';

export function createApp(config: RuntimeConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    trustProxy: (address, hop) => hop === 0 && isLoopback(address),
  });

  app.get('/health', () => ({ status: 'ok' }));

  return app;
}

const tokenSchema = z.object({ botToken: z.string().min(20).max(200) });
const connectSchema = tokenSchema.extend({
  operatorChatId: z.number().int().safe().negative(),
});
const vkConnectSchema = z.object({
  accessToken: z.string().min(20).max(500),
  community: z.string().trim().min(1).max(300),
});

export function registerSetupRoutes(
  app: FastifyInstance,
  setup: TelegramSetupController,
  vkSetup: VkSetupController | undefined,
  routeAccess: AdminRouteAccess,
  options: { assets?: FrontendAssets } = {},
): void {
  let assets = options.assets;

  function getAssets(): FrontendAssets {
    assets ??= loadFrontendAssets('/setup');
    return assets;
  }

  app.get(
    '/setup',
    { preHandler: routeAccess.requireAvailable },
    async (_request, reply) => {
      void reply.header(
        'content-security-policy',
        [
          `default-src 'none'`,
          `script-src 'self'`,
          `style-src 'self'`,
          `connect-src 'self'`,
          `frame-ancestors 'none'`,
          `form-action 'self'`,
        ].join('; '),
      );
      return reply.type('text/html; charset=utf-8').send(getAssets().html);
    },
  );
  app.get(
    '/setup/app.js',
    { preHandler: routeAccess.requireAvailable },
    async (_request, reply) =>
      reply
        .type('application/javascript; charset=utf-8')
        .send(getAssets().script),
  );
  app.get(
    '/setup/style.css',
    { preHandler: routeAccess.requireAvailable },
    async (_request, reply) =>
      reply.type('text/css; charset=utf-8').send(getAssets().styles),
  );
  app.get(
    '/api/setup/status',
    { preHandler: routeAccess.requireAuthorization },
    () => ({
      ...setup.status(),
      vk: vkSetup?.status() ?? {
        connected: false,
        locked: true,
        source: 'none',
      },
    }),
  );
  app.post('/api/setup/telegram/discover', {
    preHandler: [
      routeAccess.requireAuthorization,
      routeAccess.requireSameOrigin,
    ],
    handler: async (request, reply) => {
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
    },
  });
  app.post('/api/setup/telegram/connect', {
    preHandler: [
      routeAccess.requireAuthorization,
      routeAccess.requireSameOrigin,
    ],
    handler: async (request, reply) => {
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
    },
  });
  app.post('/api/setup/vk/connect', {
    preHandler: [
      routeAccess.requireAuthorization,
      routeAccess.requireSameOrigin,
    ],
    handler: async (request, reply) => {
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
    },
  });
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
    return 'Сначала подключите Telegram для операторов.';
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

function isLoopback(address: string): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}
