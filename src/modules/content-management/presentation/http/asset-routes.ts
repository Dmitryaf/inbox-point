import type { FastifyInstance } from 'fastify';

import type { ManagementAssets } from './assets.js';
import type { ManagementRouteAccess } from './route-access.js';

export function registerManagementAssetRoutes(
  app: FastifyInstance,
  access: ManagementRouteAccess,
  assets: ManagementAssets,
): void {
  app.get(
    '/manage',
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
    '/manage/app.js',
    { preHandler: access.requireAvailable },
    async (_request, reply) =>
      reply.type('application/javascript; charset=utf-8').send(assets.script),
  );
  app.get(
    '/manage/style.css',
    { preHandler: access.requireAvailable },
    async (_request, reply) =>
      reply.type('text/css; charset=utf-8').send(assets.styles),
  );
}
