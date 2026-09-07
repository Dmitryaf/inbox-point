import type { FastifyInstance } from 'fastify';

import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { OperationsRouteAccess } from './route-access.js';

const pilotPeriodDays = 30;
const millisecondsPerDay = 24 * 60 * 60 * 1_000;

export function registerPilotMetricsRoute(
  app: FastifyInstance,
  repository: Pick<SupportRepository, 'getPilotEventCounts'> | undefined,
  routeAccess: OperationsRouteAccess,
): void {
  app.get(
    '/api/ops/pilot-metrics',
    { preHandler: routeAccess.requireAuthorization },
    async (_request, reply) => {
      if (!repository) {
        return reply.code(503).send({
          message: 'Метрики пилота пока недоступны.',
        });
      }
      const observedAt = new Date();
      const recordedSince = new Date(
        observedAt.getTime() - pilotPeriodDays * millisecondsPerDay,
      );
      return {
        events: repository.getPilotEventCounts(recordedSince),
        observedAt: observedAt.toISOString(),
        periodDays: pilotPeriodDays,
        recordedSince: recordedSince.toISOString(),
      };
    },
  );
}
