import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ContentManagementAccess } from '@/modules/content-management/security/content-management-access.js';
import type { ManagementAssets } from './assets.js';

export interface ManagementRouteOptions {
  allowLocalBypass: boolean;
  assets?: ManagementAssets;
  secureCookies: boolean;
}

export interface ManagementRouteAccess {
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

export function createManagementRouteAccess(
  app: FastifyInstance,
  access: ContentManagementAccess,
  options: ManagementRouteOptions,
): ManagementRouteAccess {
  const cookieName = options.secureCookies
    ? '__Host-mh-content-session'
    : 'mh-content-session';
  const isAvailable = (request: FastifyRequest): boolean =>
    access.isConfigured() ||
    (options.allowLocalBypass && isLoopback(request.ip));
  const isAuthorized = (request: FastifyRequest): boolean =>
    (options.allowLocalBypass && isLoopback(request.ip)) ||
    access.authenticate(readCookie(request.headers.cookie, cookieName));

  app.addHook('onSend', async (request, reply, payload) => {
    if (isManagementUrl(request.url)) {
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
          .send({ message: 'Войдите, чтобы изменить информацию.' });
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

export function readCookie(
  header: string | undefined,
  expectedName: string,
): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name === expectedName) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

function isManagementUrl(url: string): boolean {
  return (
    url === '/manage' ||
    url.startsWith('/manage/') ||
    url.startsWith('/api/manage/')
  );
}

function isLoopback(address: string): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}
