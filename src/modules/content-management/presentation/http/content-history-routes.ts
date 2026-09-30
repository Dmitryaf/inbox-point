import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import type { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import { createContentOutput } from './content-output.js';
export function registerContentHistoryRoutes(
  app: FastifyInstance,
  content: ContentManagementService,
  access: AdminRouteAccess,
): void {
  app.get(
    '/api/manage/content/history',
    { preHandler: access.requireAuthorization },
    async (_request, reply) => {
      try {
        return { history: await content.getHistory() };
      } catch (error: unknown) {
        app.log.error({ err: error }, 'Managed content history load failed');
        return reply.code(500).send({
          message:
            'Не удалось загрузить историю изменений. Попробуйте ещё раз.',
        });
      }
    },
  );
  app.get<{ Params: { revision: string } }>(
    '/api/manage/content/history/:revision',
    { preHandler: access.requireAuthorization },
    async (request, reply) => {
      const revision = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(request.params.revision);
      if (!revision.success) {
        return reply.code(400).send({ message: 'Версия указана неверно.' });
      }
      try {
        const snapshot = await content.getRevision(revision.data);
        if (!snapshot) {
          return reply
            .code(404)
            .send({ message: 'Эта версия больше недоступна.' });
        }
        return createContentOutput(snapshot);
      } catch (error: unknown) {
        app.log.error({ err: error }, 'Managed content revision load failed');
        return reply.code(500).send({
          message: 'Не удалось загрузить версию. Попробуйте ещё раз.',
        });
      }
    },
  );
}
