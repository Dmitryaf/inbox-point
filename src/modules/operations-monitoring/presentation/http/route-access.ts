import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { FrontendAssets } from '@/infrastructure/http/frontend-assets.js';
import { readCookie } from '@/infrastructure/http/session-cookie.js';
import type { OperationsAccess } from '@/modules/operations-monitoring/security/operations-access.js';

export interface OperationsRouteOptions {
  allowLocalBypass: boolean;
  assets?: FrontendAssets;
  secureCookies: boolean;
}

export interface OperationsRouteAccess {
  cookieName: string;
  isAuthorized: (request: FastifyRequest) => boolean;
  requireAuthorization: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<unknown>;
  requireAvailable: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<unknown>;
  requireSameOrigin: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<unknown>;
}

export function createOperationsRouteAccess(
  app: FastifyInstance,
  access: OperationsAccess,
  options: OperationsRouteOptions,
): OperationsRouteAccess {
  const cookieName = options.secureCookies
    ? '__Host-mh-ops-session'
    : 'mh-ops-session';
  const isAvailable = (request: FastifyRequest): boolean =>
    access.isConfigured() ||
    (options.allowLocalBypass && isLoopback(request.ip));
  const isAuthorized = (request: FastifyRequest): boolean =>
    (options.allowLocalBypass && isLoopback(request.ip)) ||
    access.authenticate(readCookie(request.headers.cookie, cookieName));

  app.addHook('onSend', async (request, reply, payload) => {
    if (isOperationsUrl(request.url)) {
      void reply.header('cache-control', 'no-store');
      void reply.header('referrer-policy', 'no-referrer');
      void reply.header('x-content-type-options', 'nosniff');
      void reply.header('x-frame-options', 'DENY');
    }
    return payload;
  });

  return {
    cookieName,
    isAuthorized,
    requireAuthorization: async (request, reply) => {
      if (!isAvailable(request)) {
        return reply.code(404).send({ message: 'Not found' });
      }
      if (!isAuthorized(request)) {
        return reply
          .code(401)
          .send({ message: 'Войдите, чтобы увидеть состояние сервиса.' });
      }
    },
    requireAvailable: async (request, reply) => {
      if (!isAvailable(request)) {
        return reply.code(404).send({ message: 'Not found' });
      }
    },
    requireSameOrigin: async (request, reply) => {
      const origin = request.headers.origin;
      if (!origin) {
        return;
      }
      try {
        if (new URL(origin).host !== request.headers.host) {
          return reply.code(403).send({ message: 'Запрос отклонён.' });
        }
      } catch {
        return reply.code(403).send({ message: 'Запрос отклонён.' });
      }
    },
  };
}

function isOperationsUrl(url: string): boolean {
  return (
    url === '/ops' || url.startsWith('/ops/') || url.startsWith('/api/ops/')
  );
}

function isLoopback(address: string): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}
