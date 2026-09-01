import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { RuntimeConfig } from '@/config/runtime-config.js';
import { registerFrontendRoutes } from './frontend-routes.js';
import type { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';
import { setupPageHtml, setupPageScript } from './setup-page.js';

export function createApp(config: RuntimeConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  app.get('/health', () => ({ status: 'ok' }));
  app.get('/ready', () => ({ status: 'ready' }));
  registerFrontendRoutes(app);

  return app;
}

const tokenSchema = z.object({ botToken: z.string().min(20).max(200) });
const connectSchema = tokenSchema.extend({
  operatorChatId: z.number().int().safe().negative(),
});

export function registerSetupRoutes(
  app: FastifyInstance,
  setup: TelegramSetupController,
): void {
  app.addHook('onRequest', async (request, reply) => {
    if (isSetupUrl(request.url) && !isLoopback(request.ip)) {
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
      "default-src 'none'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    );
    return reply.type('text/html; charset=utf-8').send(setupPageHtml);
  });
  app.get('/setup/app.js', async (_request, reply) =>
    reply.type('application/javascript; charset=utf-8').send(setupPageScript),
  );
  app.get('/api/setup/status', () => setup.status());
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
  if (message.includes('supergroup') || message.includes('Topics'))
    return 'Включите в выбранной группе темы и попробуйте снова.';
  if (message.includes('administrator'))
    return 'Назначьте бота администратором выбранной группы.';
  if (message.includes('can_manage_topics'))
    return 'Разрешите боту управлять темами группы.';
  if (message.includes('webhook'))
    return 'У бота уже настроена другая интеграция. Отключите её или создайте отдельного бота.';
  if (message.includes('already connected')) return 'Telegram уже подключён.';
  if (message.includes('managed by server'))
    return 'Эта настройка управляется сервером.';
  return 'Не удалось подключиться. Проверьте токен, группу и права бота.';
}
