import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { InboundEventIncidentService } from '@/core/application/inbound-event-incident-service.js';
import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';

const eventParamsSchema = z.object({
  eventId: z.string().min(1).max(500),
});
const resolutionSchema = z.object({
  resolution: z.enum(['retry', 'skip']),
  source: z.literal('vk:long-poll'),
});

export function registerInboundEventRoutes(
  app: FastifyInstance,
  events: Pick<InboundEventIncidentService, 'resolve'> | undefined,
  routeAccess: AdminRouteAccess,
): void {
  app.post(
    '/api/ops/inbound-events/:eventId/resolve',
    {
      preHandler: [
        routeAccess.requireAuthorization,
        routeAccess.requireSameOrigin,
      ],
    },
    async (request, reply) => {
      if (!events) {
        return reply
          .code(503)
          .send({ message: 'Управление входящими событиями недоступно.' });
      }
      const params = eventParamsSchema.safeParse(request.params);
      const body = resolutionSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply
          .code(400)
          .send({ message: 'Не удалось обработать входящее событие.' });
      }
      const resolved = events.resolve(
        body.data.source,
        params.data.eventId,
        body.data.resolution,
      );
      return resolved
        ? { resolved: true }
        : reply.code(409).send({ message: 'Инцидент уже обработан.' });
    },
  );
}
