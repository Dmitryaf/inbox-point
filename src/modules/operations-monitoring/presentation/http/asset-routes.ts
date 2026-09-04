import type { FastifyInstance } from 'fastify';

import type { OperationsAssets } from './assets.js';
import type { OperationsRouteAccess } from './route-access.js';

export function registerOperationsAssetRoutes(
  app: FastifyInstance,
  access: OperationsRouteAccess,
  assets: OperationsAssets,
): void {
  app.get(
    '/ops',
    { preHandler: access.requireAvailable },
    async (_request, reply) => {
      void reply.header(
        'content-security-policy',
        [
          `default-src 'none'`,
          `script-src 'self'`,
          `style-src 'self'`,
          `connect-src 'self'`,
          `frame-ancestors 'none'`,
          `form-action 'self'`,
        ].join('; '),
      );
      return reply.type('text/html; charset=utf-8').send(assets.html);
    },
  );
  app.get(
    '/ops/app.js',
    { preHandler: access.requireAvailable },
    async (_request, reply) =>
      reply.type('application/javascript; charset=utf-8').send(assets.script),
  );
  app.get(
    '/ops/style.css',
    { preHandler: access.requireAvailable },
    async (_request, reply) =>
      reply.type('text/css; charset=utf-8').send(assets.styles),
  );
}
