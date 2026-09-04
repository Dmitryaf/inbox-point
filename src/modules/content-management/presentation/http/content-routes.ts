import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { contentInputSchema, normalizeContentInput } from './content-input.js';
import type { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import type { ManagementRouteAccess } from './route-access.js';

const restoreSchema = z.object({
  revision: z.number().int().positive(),
});

export function registerManagementContentRoutes(
  app: FastifyInstance,
  content: ContentManagementService,
  access: ManagementRouteAccess,
): void {
  app.get(
    '/api/manage/content',
    { preHandler: access.requireAuthorization },
    () => content.get(),
  );
  app.get(
    '/api/manage/content/history',
    { preHandler: access.requireAuthorization },
    async () => ({ history: await content.getHistory() }),
  );
  app.post(
    '/api/manage/content',
    {
      preHandler: [access.requireAuthorization, access.requireSameOrigin],
    },
    async (request, reply) => {
      const parsed = contentInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          message: 'Каждый раздел должен быть короче 4000 символов.',
        });
      }
      const normalized = normalizeContentInput(parsed.data);
      if (!normalized) {
        return reply.code(400).send({
          message:
            'Проверьте названия и тексты кнопок. Каждый частый вопрос должен содержать ответ.',
        });
      }
      try {
        await content.save(normalized);
        return { saved: true };
      } catch (error: unknown) {
        app.log.error({ err: error }, 'Managed content settings save failed');
        return reply.code(500).send({
          message: 'Не удалось сохранить информацию. Попробуйте ещё раз.',
        });
      }
    },
  );
  app.post(
    '/api/manage/content/restore',
    {
      preHandler: [access.requireAuthorization, access.requireSameOrigin],
    },
    async (request, reply) => {
      const parsed = restoreSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: 'Версия указана неверно.' });
      }
      try {
        await content.restore(parsed.data.revision);
        return { restored: true };
      } catch (error: unknown) {
        if (isUnavailableRevision(error)) {
          return reply.code(404).send({
            message: 'Эта версия больше недоступна для восстановления.',
          });
        }
        app.log.error({ err: error }, 'Managed content restore failed');
        return reply.code(500).send({
          message: 'Не удалось восстановить информацию. Попробуйте ещё раз.',
        });
      }
    },
  );
}

function isUnavailableRevision(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === 'The requested content revision is unavailable'
  );
}
