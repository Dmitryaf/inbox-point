import type { FastifyInstance } from 'fastify';

import type { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import type { ContentManagementAccess } from '@/modules/content-management/security/content-management-access.js';
import { registerManagementAssetRoutes } from './asset-routes.js';
import { loadManagementAssets } from './assets.js';
import { registerManagementContentRoutes } from './content-routes.js';
import {
  createManagementRouteAccess,
  type ManagementRouteOptions,
} from './route-access.js';
import { registerManagementSessionRoutes } from './session-routes.js';

export function registerManagementRoutes(
  app: FastifyInstance,
  content: ContentManagementService,
  access: ContentManagementAccess,
  options: ManagementRouteOptions,
): void {
  const routeAccess = createManagementRouteAccess(app, access, options);
  const assets = options.assets ?? loadManagementAssets();

  registerManagementAssetRoutes(app, routeAccess, assets);
  registerManagementSessionRoutes(
    app,
    access,
    routeAccess,
    options.secureCookies,
  );
  registerManagementContentRoutes(app, content, routeAccess);
}
