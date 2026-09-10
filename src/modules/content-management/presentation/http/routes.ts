import type { FastifyInstance } from 'fastify';

import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import type { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import { registerManagementContentRoutes } from './content-routes.js';

export function registerManagementRoutes(
  app: FastifyInstance,
  content: ContentManagementService,
  routeAccess: AdminRouteAccess,
): void {
  registerManagementContentRoutes(app, content, routeAccess);
}
