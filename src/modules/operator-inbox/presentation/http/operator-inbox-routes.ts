import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import {
  OperatorRequestClosedError,
  OperatorRequestNotFoundError,
} from '@/modules/operator-inbox/application/operator-inbox-service.js';
import type { OperatorInboxService } from '@/modules/operator-inbox/application/operator-inbox-service.js';

const requestParamsSchema = z.object({
  requestId: z.string().min(1).max(100),
});
const actionSchema = z.object({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
});
const replySchema = actionSchema.extend({
  text: z.string().trim().min(1).max(4_000),
});

export function registerOperatorInboxRoutes(
  app: FastifyInstance,
  inbox: OperatorInboxService | undefined,
  routeAccess: AdminRouteAccess,
): void {
  app.get(
    '/api/ops/inbox/requests',
    { preHandler: routeAccess.requireAuthorization },
    async (_request, reply) => {
      if (!inbox) {
        return unavailable(reply);
      }
      try {
        return { requests: inbox.getActiveRequests() };
      } catch (error: unknown) {
        return handleActionError(app, error, reply);
      }
    },
  );

  app.get(
    '/api/ops/inbox/requests/:requestId/messages',
    { preHandler: routeAccess.requireAuthorization },
    async (request, reply) => {
      if (!inbox) {
        return unavailable(reply);
      }
      const params = requestParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(404).send({ message: 'Обращение не найдено.' });
      }
      try {
        return { messages: inbox.getMessages(params.data.requestId) };
      } catch (error: unknown) {
        return handleActionError(app, error, reply);
      }
    },
  );

  app.post(
    '/api/ops/inbox/requests/:requestId/replies',
    {
      preHandler: [
        routeAccess.requireAuthorization,
        routeAccess.requireSameOrigin,
      ],
    },
    async (request, reply) => {
      if (!inbox) {
        return unavailable(reply);
      }
      const params = requestParamsSchema.safeParse(request.params);
      const body = replySchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({
          message: 'Введите ответ длиной до 4000 символов.',
        });
      }
      try {
        await inbox.reply(params.data.requestId, {
          idempotencyKey: body.data.idempotencyKey,
          occurredAt: new Date(),
          text: body.data.text,
        });
        return { queued: true };
      } catch (error: unknown) {
        return handleActionError(app, error, reply);
      }
    },
  );

  app.post(
    '/api/ops/inbox/requests/:requestId/close',
    {
      preHandler: [
        routeAccess.requireAuthorization,
        routeAccess.requireSameOrigin,
      ],
    },
    async (request, reply) => {
      if (!inbox) {
        return unavailable(reply);
      }
      const params = requestParamsSchema.safeParse(request.params);
      const body = actionSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply
          .code(400)
          .send({ message: 'Не удалось закрыть обращение.' });
      }
      try {
        await inbox.closeRequest(params.data.requestId, {
          idempotencyKey: body.data.idempotencyKey,
          occurredAt: new Date(),
        });
        return { closed: true };
      } catch (error: unknown) {
        return handleActionError(app, error, reply);
      }
    },
  );
}

function handleActionError(
  app: FastifyInstance,
  error: unknown,
  reply: FastifyReply,
) {
  if (error instanceof OperatorRequestNotFoundError) {
    return reply.code(404).send({ message: 'Обращение не найдено.' });
  }
  if (error instanceof OperatorRequestClosedError) {
    return reply.code(409).send({ message: 'Обращение уже закрыто.' });
  }
  app.log.error({ err: error }, 'Emergency operator inbox action failed');
  return reply.code(500).send({
    message: 'Не удалось выполнить действие. Попробуйте ещё раз.',
  });
}

function unavailable(reply: FastifyReply) {
  return reply
    .code(503)
    .send({ message: 'Резервный входящий ящик пока недоступен.' });
}
