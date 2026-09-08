import type { FastifyInstance } from 'fastify';

import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import type { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';

export function registerOperationsStatusRoutes(
  app: FastifyInstance,
  monitoring: OperationsMonitoringService,
  routeAccess: AdminRouteAccess,
): void {
  app.get(
    '/api/ops/status',
    { preHandler: routeAccess.requireAuthorization },
    async (_request, reply) => {
      try {
        return monitoring.getStatus();
      } catch {
        return reply.code(503).send({
          message: 'Не удалось прочитать состояние сервиса.',
        });
      }
    },
  );
}
