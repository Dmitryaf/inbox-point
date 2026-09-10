import type { FastifyInstance, FastifyReply } from 'fastify';

import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import type { FrontendAssets } from '@/infrastructure/http/frontend-assets.js';

const frontendContentSecurityPolicy = [
  `default-src 'none'`,
  `script-src 'self'`,
  `style-src 'self'`,
  `connect-src 'self'`,
  `img-src 'self'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
].join('; ');

const frontendPagePaths = ['/login', '/manage', '/setup', '/ops'] as const;

export function registerFrontendRoutes(
  app: FastifyInstance,
  access: AdminRouteAccess,
  assets: FrontendAssets,
): void {
  for (const path of frontendPagePaths) {
    app.get(
      path,
      { preHandler: access.requireAvailable },
      async (_request, reply) => sendFrontendPage(reply, assets),
    );
  }

  registerAsset(
    app,
    access,
    '/favicon.svg',
    'image/svg+xml; charset=utf-8',
    assets.icon,
  );
  registerAsset(
    app,
    access,
    '/app.js',
    'application/javascript; charset=utf-8',
    assets.script,
  );
  registerAsset(
    app,
    access,
    '/style.css',
    'text/css; charset=utf-8',
    assets.styles,
  );

  app.get(
    '/*',
    { preHandler: access.requireAvailable },
    async (request, reply) => {
      const path = request.url.split('?', 1)[0] ?? request.url;
      if (path === '/api' || path.startsWith('/api/')) {
        return reply.code(404).send({ message: 'Not found' });
      }
      return sendFrontendPage(reply, assets);
    },
  );
}

function sendFrontendPage(
  reply: FastifyReply,
  assets: FrontendAssets,
): unknown {
  void reply.header('cache-control', 'no-store');
  void reply.header('content-security-policy', frontendContentSecurityPolicy);
  void reply.header('referrer-policy', 'no-referrer');
  void reply.header('x-content-type-options', 'nosniff');
  void reply.header('x-frame-options', 'DENY');
  return reply.type('text/html; charset=utf-8').send(assets.html);
}

function registerAsset(
  app: FastifyInstance,
  access: AdminRouteAccess,
  path: string,
  contentType: string,
  contents: string,
): void {
  app.get(
    path,
    { preHandler: access.requireAvailable },
    async (_request, reply) => reply.type(contentType).send(contents),
  );
}
