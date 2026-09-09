import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { OperatorActionIncidentService } from '@/core/application/operator-action-incident-service.js';
import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';

const actionParamsSchema = z.object({
  actionId: z.string().min(1).max(500),
});
const resolutionSchema = z.object({
  resolution: z.enum(['received', 'use_web']),
});

export function registerOperatorActionRoutes(
  app: FastifyInstance,
  actions: Pick<OperatorActionIncidentService, 'resolve'> | undefined,
  routeAccess: AdminRouteAccess,
): void {
  app.post(
    '/api/ops/operator-actions/:actionId/resolve',
    {
      preHandler: [
        routeAccess.requireAuthorization,
        routeAccess.requireSameOrigin,
      ],
    },
    async (request, reply) => {
      if (!actions) {
        return reply
          .code(503)
          .send({ message: 'Управление передачей обращений недоступно.' });
      }
      const params = actionParamsSchema.safeParse(request.params);
      const body = resolutionSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply
          .code(400)
          .send({ message: 'Не удалось уточнить передачу обращения.' });
      }
      const resolved = actions.resolve(
        params.data.actionId,
        body.data.resolution,
      );
      if (!resolved) {
        return reply.code(409).send({
          message: 'Инцидент уже обработан или выбранное действие недоступно.',
        });
      }
      return { resolved: true };
    },
  );
}
