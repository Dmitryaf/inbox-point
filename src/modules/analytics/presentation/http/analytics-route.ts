import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  analyticsPeriods,
  type AnalyticsService,
} from '@/modules/analytics/application/analytics-service.js';
import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';

const querySchema = z
  .object({
    period: z.enum(analyticsPeriods).default('30d'),
    channel: z.enum(['all', 'telegram', 'vk']).default('all'),
  })
  .strict();

export function registerAnalyticsRoute(
  app: FastifyInstance,
  service: AnalyticsService,
  access: AdminRouteAccess,
): void {
  app.get('/api/analytics', {
    preHandler: access.requireAuthorization,
    handler: (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ message: 'Выберите период и канал из списка.' });
      }
      return service.get(parsed.data.period, parsed.data.channel);
    },
  });
}
