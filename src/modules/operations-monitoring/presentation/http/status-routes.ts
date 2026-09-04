import type { FastifyInstance } from 'fastify';

import type { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import type { OperationsRouteAccess } from './route-access.js';

export function registerOperationsStatusRoutes(
  app: FastifyInstance,
  monitoring: OperationsMonitoringService,
  routeAccess: OperationsRouteAccess,
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
