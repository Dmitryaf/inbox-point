import type { FastifyInstance } from 'fastify';

import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import {
  loadFrontendAssets,
  type FrontendAssets,
} from '@/infrastructure/http/frontend-assets.js';
import type { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import { registerManagementAssetRoutes } from './asset-routes.js';
import { registerManagementContentRoutes } from './content-routes.js';

export function registerManagementRoutes(
  app: FastifyInstance,
  content: ContentManagementService,
  routeAccess: AdminRouteAccess,
  options: { assets?: FrontendAssets } = {},
): void {
  const assets = options.assets ?? loadFrontendAssets('/manage');

  registerManagementAssetRoutes(app, routeAccess, assets);
  registerManagementContentRoutes(app, content, routeAccess);
}
