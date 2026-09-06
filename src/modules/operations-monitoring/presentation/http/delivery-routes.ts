import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { OperationsRouteAccess } from './route-access.js';

const deliveryParamsSchema = z.object({
  deliveryId: z.string().min(1).max(100),
});

export function registerOperationsDeliveryRoutes(
  app: FastifyInstance,
  deliveries: Pick<SupportRepository, 'retryFailedDelivery'> | undefined,
  routeAccess: OperationsRouteAccess,
): void {
  app.post(
    '/api/ops/deliveries/:deliveryId/retry',
    {
      preHandler: [
        routeAccess.requireAuthorization,
        routeAccess.requireSameOrigin,
      ],
    },
    async (request, reply) => {
      if (!deliveries) {
        return reply
          .code(503)
          .send({ message: 'Управление доставкой пока недоступно.' });
      }
      const parsed = deliveryParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(404).send({ message: 'Ответ не найден.' });
      }
      const queued = deliveries.retryFailedDelivery(
        parsed.data.deliveryId,
        new Date(),
      );
      if (!queued) {
        return reply.code(409).send({
          message:
            'Ответ уже отправляется, больше не требует повтора или нуждается в ручной проверке.',
        });
      }
      return { queued: true };
    },
  );
}
