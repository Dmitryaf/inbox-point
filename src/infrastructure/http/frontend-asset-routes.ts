import type { FastifyInstance } from 'fastify';

import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import type {
  FrontendAssets,
  FrontendRouteBase,
} from '@/infrastructure/http/frontend-assets.js';

const frontendContentSecurityPolicy = [
  `default-src 'none'`,
  `script-src 'self'`,
  `style-src 'self'`,
  `connect-src 'self'`,
  `img-src 'self'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
].join('; ');

interface FrontendAssetRouteOptions {
  assets: FrontendAssets;
  basePath: FrontendRouteBase;
  pagePaths: readonly string[];
}

export function registerFrontendAssetRoutes(
  app: FastifyInstance,
  access: AdminRouteAccess,
  options: FrontendAssetRouteOptions,
): void {
  for (const path of options.pagePaths) {
    app.get(
      path,
      { preHandler: access.requireAvailable },
      async (_request, reply) => {
        void reply.header(
          'content-security-policy',
          frontendContentSecurityPolicy,
        );
        return reply.type('text/html; charset=utf-8').send(options.assets.html);
      },
    );
  }

  registerAsset(
    app,
    access,
    `${options.basePath}/favicon.svg`,
    'image/svg+xml; charset=utf-8',
    options.assets.icon,
  );
  registerAsset(
    app,
    access,
    `${options.basePath}/app.js`,
    'application/javascript; charset=utf-8',
    options.assets.script,
  );
  registerAsset(
    app,
    access,
    `${options.basePath}/style.css`,
    'text/css; charset=utf-8',
    options.assets.styles,
  );
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
