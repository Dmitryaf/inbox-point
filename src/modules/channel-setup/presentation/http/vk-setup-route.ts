import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { vkSetupErrorMessage } from '@/modules/channel-setup/presentation/http/setup-error-message.js';

export interface VkSetupRouteController {
  connect(accessToken: string, community: string): Promise<void>;
}

const vkConnectSchema = z.object({
  accessToken: z.string().min(20).max(500),
  community: z.string().trim().min(1).max(300),
});

export function registerVkSetupRoute(
  app: FastifyInstance,
  vkSetup: VkSetupRouteController | undefined,
  routeAccess: AdminRouteAccess,
): void {
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
