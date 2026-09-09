import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { readCookie } from '@/infrastructure/http/session-cookie.js';
import type { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';

export interface AdminRouteAccessOptions {
  allowLocalBypass: boolean;
  secureCookies: boolean;
}

export interface AdminRouteAccess {
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

export function createAdminRouteAccess(
  app: FastifyInstance,
  access: PasswordSessionAccess,
  options: AdminRouteAccessOptions,
): AdminRouteAccess {
  const cookieName = options.secureCookies
    ? '__Host-mh-admin-session'
    : 'mh-admin-session';
  const isAvailable = (request: FastifyRequest): boolean =>
    access.isConfigured() ||
    (options.allowLocalBypass && isLoopback(request.ip));
  const isAuthorized = (request: FastifyRequest): boolean =>
    (options.allowLocalBypass && isLoopback(request.ip)) ||
    access.authenticate(readCookie(request.headers.cookie, cookieName));

  app.addHook('onSend', async (request, reply, payload) => {
    if (isAdminUrl(request.url)) {
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
        return reply.code(401).send({ message: 'Войдите, чтобы продолжить.' });
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
        const parsedOrigin = new URL(origin);
        if (
          parsedOrigin.protocol !== `${request.protocol}:` ||
          parsedOrigin.host !== request.headers.host
        ) {
          return reply.code(403).send({ message: 'Запрос отклонён.' });
        }
      } catch {
        return reply.code(403).send({ message: 'Запрос отклонён.' });
      }
    },
  };
}

function isAdminUrl(url: string): boolean {
  const path = url.split('?', 1)[0] ?? url;
  return (
    path === '/manage' ||
    path.startsWith('/manage/') ||
    path === '/ops' ||
    path.startsWith('/ops/') ||
    path === '/setup' ||
    path.startsWith('/setup/') ||
    path.startsWith('/api/admin/') ||
    path.startsWith('/api/manage/') ||
    path.startsWith('/api/ops/') ||
    path.startsWith('/api/setup/')
  );
}

function isLoopback(address: string): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}
