import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';

const deliveryParamsSchema = z.object({
  deliveryId: z.string().min(1).max(100),
});
const resolutionSchema = z.object({
  resolution: z.enum(['received', 'not_received']),
});

type DeliveryOperationsRepository = Pick<
  SupportRepository,
  | 'confirmUnknownDeliveryNotReceived'
  | 'confirmUnknownDeliveryReceived'
  | 'retryFailedDelivery'
>;

export function registerOperationsDeliveryRoutes(
  app: FastifyInstance,
  deliveries: DeliveryOperationsRepository | undefined,
  routeAccess: AdminRouteAccess,
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

  app.post(
    '/api/ops/deliveries/:deliveryId/resolve',
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
      const params = deliveryParamsSchema.safeParse(request.params);
      const body = resolutionSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply
          .code(400)
          .send({ message: 'Не удалось уточнить доставку.' });
      }
      const now = new Date();
      const resolved =
        body.data.resolution === 'received'
          ? deliveries.confirmUnknownDeliveryReceived(
              params.data.deliveryId,
              now,
            )
          : deliveries.confirmUnknownDeliveryNotReceived(
              params.data.deliveryId,
              now,
            );
      if (!resolved) {
        return reply.code(409).send({
          message: 'Ответ уже обработан или не требует ручной проверки.',
        });
      }
      return {
        queued: body.data.resolution === 'not_received',
        resolved: true,
      };
    },
  );
}
