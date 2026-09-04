import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  createSessionCookie,
  readCookie,
} from '@/infrastructure/http/session-cookie.js';
import type { OperationsAccess } from '@/modules/operations-monitoring/security/operations-access.js';
import type { OperationsRouteAccess } from './route-access.js';

const passwordSchema = z.object({
  password: z.string().min(1).max(200),
});
const sessionMaxAgeSeconds = 12 * 60 * 60;

export function registerOperationsSessionRoutes(
  app: FastifyInstance,
  access: OperationsAccess,
  routeAccess: OperationsRouteAccess,
  secureCookies: boolean,
): void {
  app.get(
    '/api/ops/session',
    { preHandler: routeAccess.requireAvailable },
    (request) => ({ authenticated: routeAccess.isAuthorized(request) }),
  );
  app.post(
    '/api/ops/login',
    {
      preHandler: [routeAccess.requireAvailable, routeAccess.requireSameOrigin],
    },
    async (request, reply) => {
      if (routeAccess.isAuthorized(request)) {
        return { authenticated: true };
      }
      const parsed = passwordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(401).send({ message: 'Неверный пароль.' });
      }
      const result = access.login(parsed.data.password, request.ip);
      if (result.kind === 'invalid') {
        return reply.code(401).send({ message: 'Неверный пароль.' });
      }
      if (result.kind === 'blocked') {
        void reply.header('retry-after', String(result.retryAfterSeconds));
        return reply.code(429).send({
          message: 'Слишком много попыток. Попробуйте позже.',
        });
      }
      void reply.header(
        'set-cookie',
        createSessionCookie(
          routeAccess.cookieName,
          result.token,
          sessionMaxAgeSeconds,
          secureCookies,
        ),
      );
      return { authenticated: true };
    },
  );
  app.post(
    '/api/ops/logout',
    {
      preHandler: [routeAccess.requireAvailable, routeAccess.requireSameOrigin],
    },
    (request, reply) => {
      access.logout(readCookie(request.headers.cookie, routeAccess.cookieName));
      void reply.header(
        'set-cookie',
        createSessionCookie(routeAccess.cookieName, '', 0, secureCookies),
      );
      return { authenticated: false };
    },
  );
}
