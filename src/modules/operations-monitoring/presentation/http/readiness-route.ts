import type { FastifyInstance } from 'fastify';

import type { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';

export function registerReadinessRoute(
  app: FastifyInstance,
  monitoring: OperationsMonitoringService,
): void {
  app.get('/ready', async (_request, reply) => {
    try {
      if (monitoring.isReady()) {
        return { status: 'ready' };
      }
    } catch {
      // The public probe intentionally does not disclose the failing dependency.
    }

    return reply.code(503).send({ status: 'not_ready' });
  });
}
