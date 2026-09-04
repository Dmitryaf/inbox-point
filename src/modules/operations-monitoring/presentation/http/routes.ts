import type { FastifyInstance } from 'fastify';

import type { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import type { OperationsAccess } from '@/modules/operations-monitoring/security/operations-access.js';
import { registerOperationsAssetRoutes } from './asset-routes.js';
import { loadOperationsAssets } from './assets.js';
import {
  createOperationsRouteAccess,
  type OperationsRouteOptions,
} from './route-access.js';
import { registerOperationsSessionRoutes } from './session-routes.js';
import { registerOperationsStatusRoutes } from './status-routes.js';

export function registerOperationsRoutes(
  app: FastifyInstance,
  monitoring: OperationsMonitoringService,
  access: OperationsAccess,
  options: OperationsRouteOptions,
): void {
  const routeAccess = createOperationsRouteAccess(app, access, options);
  const assets = options.assets ?? loadOperationsAssets();

  registerOperationsAssetRoutes(app, routeAccess, assets);
  registerOperationsSessionRoutes(
    app,
    access,
    routeAccess,
    options.secureCookies,
  );
  registerOperationsStatusRoutes(app, monitoring, routeAccess);
}
