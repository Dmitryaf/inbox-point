import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { ClientChannelKind } from '@/core/model/support-message.js';
import type { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';

interface ServiceControlRouteAccess {
  requireAuthorization: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<unknown>;
  requireSameOrigin: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<unknown>;
}

const channelSchema = z.enum(['telegram', 'vk']);

export function registerServiceControlRoutes(
  app: FastifyInstance,
  serviceControl: ServiceControlService,
  access: ServiceControlRouteAccess,
  basePath = '/api/manage/service-control',
): void {
  app.get(basePath, { preHandler: access.requireAuthorization }, () =>
    serviceControl.getState(),
  );

  app.post(
    basePath + '/:channel/pause',
    {
      preHandler: [access.requireAuthorization, access.requireSameOrigin],
    },
    async (request, reply) => {
      const channel = parseChannel(request.params);
      if (!channel) {
        return reply.code(404).send({ message: 'Канал не найден.' });
      }
      try {
        return await serviceControl.pause(channel);
      } catch (error: unknown) {
        app.log.error({ err: error }, 'Client intake pause failed');
        return reply.code(500).send({
          message: 'Не удалось приостановить новые обращения.',
        });
      }
    },
  );

  app.post(
    basePath + '/:channel/resume',
    {
      preHandler: [access.requireAuthorization, access.requireSameOrigin],
    },
    async (request, reply) => {
      const channel = parseChannel(request.params);
      if (!channel) {
        return reply.code(404).send({ message: 'Канал не найден.' });
      }
      try {
        return await serviceControl.resume(channel);
      } catch (error: unknown) {
        app.log.error({ err: error }, 'Client intake resume failed');
        return reply.code(500).send({
          message: 'Не удалось возобновить новые обращения.',
        });
      }
    },
  );
}

function parseChannel(params: unknown): ClientChannelKind | undefined {
  const parsed = z.object({ channel: channelSchema }).safeParse(params);
  return parsed.success ? parsed.data.channel : undefined;
}
