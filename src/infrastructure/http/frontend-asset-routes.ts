import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

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
      async (request, reply) => sendFrontendPage(request, reply, assets),
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
    '/inbox-point-social-preview.png',
    'image/png',
    assets.socialPreview,
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
      return sendFrontendPage(request, reply, assets);
    },
  );
}

function sendFrontendPage(
  request: FastifyRequest,
  reply: FastifyReply,
  assets: FrontendAssets,
): unknown {
  void reply.header('cache-control', 'no-store');
  void reply.header('content-security-policy', frontendContentSecurityPolicy);
  void reply.header('referrer-policy', 'no-referrer');
  void reply.header('x-content-type-options', 'nosniff');
  void reply.header('x-frame-options', 'DENY');
  return reply
    .type('text/html; charset=utf-8')
    .send(renderFrontendHtml(request, assets.html));
}

function renderFrontendHtml(request: FastifyRequest, html: string): string {
  return html.replaceAll('__INBOX_POINT_ORIGIN__', requestOrigin(request));
}

function requestOrigin(request: FastifyRequest): string {
  try {
    const origin = new URL(`${request.protocol}://${request.host}`);
    if (origin.protocol !== 'http:' && origin.protocol !== 'https:') {
      return '';
    }
    return escapeHtmlAttribute(origin.origin);
  } catch {
    return '';
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function registerAsset(
  app: FastifyInstance,
  access: AdminRouteAccess,
  path: string,
  contentType: string,
  contents: string | Buffer,
): void {
  app.get(
    path,
    { preHandler: access.requireAvailable },
    async (_request, reply) => {
      void reply.header('cache-control', 'no-store');
      return reply.type(contentType).send(contents);
    },
  );
}
