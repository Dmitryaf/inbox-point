import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { OperationsRouteAccess } from './route-access.js';

const usagePeriodDays = 30;
const millisecondsPerDay = 24 * 60 * 60 * 1_000;

export function registerUsageMetricsRoute(
  app: FastifyInstance,
  repository: Pick<SupportRepository, 'getUsageEventCounts'> | undefined,
  routeAccess: OperationsRouteAccess,
): void {
  app.get('/api/ops/usage-metrics', {
    preHandler: routeAccess.requireAuthorization,
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      if (!repository) {
        return reply.code(503).send({
          message: 'Метрики пока недоступны.',
        });
      }
      const observedAt = new Date();
      const recordedSince = new Date(
        observedAt.getTime() - usagePeriodDays * millisecondsPerDay,
      );
      return {
        events: repository.getUsageEventCounts(recordedSince),
        observedAt: observedAt.toISOString(),
        periodDays: usagePeriodDays,
        recordedSince: recordedSince.toISOString(),
      };
    },
  });
}
