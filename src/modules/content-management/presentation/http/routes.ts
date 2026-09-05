import type { FastifyInstance } from 'fastify';

import { loadFrontendAssets } from '@/infrastructure/http/frontend-assets.js';
import type { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import type { ContentManagementAccess } from '@/modules/content-management/security/content-management-access.js';
import type { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';
import { registerServiceControlRoutes } from '@/modules/service-control/presentation/http/service-control-routes.js';
import { registerManagementAssetRoutes } from './asset-routes.js';
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
  serviceControl?: ServiceControlService,
): void {
  const routeAccess = createManagementRouteAccess(app, access, options);
  const assets = options.assets ?? loadFrontendAssets('/manage');

  registerManagementAssetRoutes(app, routeAccess, assets);
  registerManagementSessionRoutes(
    app,
    access,
    routeAccess,
    options.secureCookies,
  );
  registerManagementContentRoutes(app, content, routeAccess);
  if (serviceControl) {
    registerServiceControlRoutes(app, serviceControl, routeAccess);
  }
}
