import type { FastifyInstance } from 'fastify';

import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerFrontendAssetRoutes } from '@/infrastructure/http/frontend-asset-routes.js';
import {
  loadFrontendAssets,
  type FrontendAssets,
} from '@/infrastructure/http/frontend-assets.js';
import type { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import { registerManagementContentRoutes } from './content-routes.js';

export function registerManagementRoutes(
  app: FastifyInstance,
  content: ContentManagementService,
  routeAccess: AdminRouteAccess,
  options: { assets?: FrontendAssets } = {},
): void {
  const assets = options.assets ?? loadFrontendAssets('/manage');

  registerFrontendAssetRoutes(app, routeAccess, {
    assets,
    basePath: '/manage',
    pagePaths: ['/login', '/manage'],
  });
  registerManagementContentRoutes(app, content, routeAccess);
}
