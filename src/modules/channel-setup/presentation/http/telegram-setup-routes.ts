import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { telegramSetupErrorMessage } from '@/modules/channel-setup/presentation/http/setup-error-message.js';

export interface TelegramSetupRouteController {
  connect(botToken: string, operatorChatId: number): Promise<void>;
  discover(botToken: string): Promise<readonly unknown[]>;
}

const tokenSchema = z.object({ botToken: z.string().min(20).max(200) });
const connectSchema = tokenSchema.extend({
  operatorChatId: z.number().int().safe().negative(),
});

export function registerTelegramSetupRoutes(
  app: FastifyInstance,
  setup: TelegramSetupRouteController,
  routeAccess: AdminRouteAccess,
): void {
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
        return reply
          .code(400)
          .send({ message: telegramSetupErrorMessage(error) });
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
        return reply
          .code(400)
          .send({ message: telegramSetupErrorMessage(error) });
      }
    },
  });
}
