import type { FastifyInstance } from 'fastify';

import type { SupportRepository } from '@/core/contracts/support-repository.js';
import { loadFrontendAssets } from '@/infrastructure/http/frontend-assets.js';
import type { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import type { OperatorInboxService } from '@/modules/operator-inbox/application/operator-inbox-service.js';
import { registerOperatorInboxRoutes } from '@/modules/operator-inbox/presentation/http/operator-inbox-routes.js';
import type { OperationsAccess } from '@/modules/operations-monitoring/security/operations-access.js';
import type { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';
import { registerServiceControlRoutes } from '@/modules/service-control/presentation/http/service-control-routes.js';
import { registerOperationsAssetRoutes } from './asset-routes.js';
import { registerOperationsDeliveryRoutes } from './delivery-routes.js';
import {
  createOperationsRouteAccess,
  type OperationsRouteOptions,
} from './route-access.js';
import { registerOperationsSessionRoutes } from './session-routes.js';
import { registerOperationsStatusRoutes } from './status-routes.js';
import { registerPilotMetricsRoute } from './pilot-metrics-route.js';

export function registerOperationsRoutes(
  app: FastifyInstance,
  monitoring: OperationsMonitoringService,
  access: OperationsAccess,
  options: OperationsRouteOptions,
  serviceControl?: ServiceControlService,
  deliveries?: Pick<
    SupportRepository,
    | 'confirmUnknownDeliveryNotReceived'
    | 'confirmUnknownDeliveryReceived'
    | 'retryFailedDelivery'
  >,
  operatorInbox?: OperatorInboxService,
  pilotMetrics?: Pick<SupportRepository, 'getPilotEventCounts'>,
): void {
  const routeAccess = createOperationsRouteAccess(app, access, options);
  const assets = options.assets ?? loadFrontendAssets('/ops');

  registerOperationsAssetRoutes(app, routeAccess, assets);
  registerOperationsSessionRoutes(
    app,
    access,
    routeAccess,
    options.secureCookies,
  );
  registerOperationsStatusRoutes(app, monitoring, routeAccess);
  registerOperationsDeliveryRoutes(app, deliveries, routeAccess);
  registerOperatorInboxRoutes(app, operatorInbox, routeAccess);
  registerPilotMetricsRoute(app, pilotMetrics, routeAccess);
  if (serviceControl) {
    registerServiceControlRoutes(
      app,
      serviceControl,
      routeAccess,
      '/api/ops/service-control',
      true,
    );
  }
}
