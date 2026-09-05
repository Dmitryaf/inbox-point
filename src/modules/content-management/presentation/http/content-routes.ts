import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { contentInputSchema, normalizeContentInput } from './content-input.js';
import {
  ContentVersionConflictError,
  type ContentManagementService,
} from '@/modules/content-management/application/content-management-service.js';
import type { ManagementRouteAccess } from './route-access.js';

const restoreSchema = z
  .object({
    revision: z.number().int().positive(),
    version: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const saveSchema = z
  .object({
    content: contentInputSchema,
    version: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

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
      const parsed = saveSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          message: 'Каждый раздел должен быть короче 4000 символов.',
        });
      }
      const normalized = normalizeContentInput(parsed.data.content);
      if (!normalized) {
        return reply.code(400).send({
          message:
            'Проверьте названия и тексты разделов. Каждый вопрос должен содержать ответ, а готовый ответ клиенту — быть короче 4000 символов.',
        });
      }
      try {
        return await content.save(normalized, parsed.data.version);
      } catch (error: unknown) {
        if (error instanceof ContentVersionConflictError) {
          return reply.code(409).send({
            message:
              'Информация уже изменилась в другой вкладке. Скопируйте свои правки, затем обновите страницу и внесите их повторно.',
          });
        }
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
        return await content.restore(parsed.data.revision, parsed.data.version);
      } catch (error: unknown) {
        if (error instanceof ContentVersionConflictError) {
          return reply.code(409).send({
            message:
              'Информация уже изменилась в другой вкладке. Обновите страницу перед восстановлением версии.',
          });
        }
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
