import type { FastifyInstance } from 'fastify';

import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { OperatorActionIncidentService } from '@/core/application/operator-action-incident-service.js';
import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import {
  loadFrontendAssets,
  type FrontendAssets,
} from '@/infrastructure/http/frontend-assets.js';
import type { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import type { OperatorInboxService } from '@/modules/operator-inbox/application/operator-inbox-service.js';
import { registerOperatorInboxRoutes } from '@/modules/operator-inbox/presentation/http/operator-inbox-routes.js';
import type { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';
import { registerServiceControlRoutes } from '@/modules/service-control/presentation/http/service-control-routes.js';
import { registerOperationsAssetRoutes } from './asset-routes.js';
import { registerOperationsDeliveryRoutes } from './delivery-routes.js';
import { registerOperationsStatusRoutes } from './status-routes.js';
import { registerOperatorActionRoutes } from './operator-action-routes.js';
import { registerUsageMetricsRoute } from './usage-metrics-route.js';

export function registerOperationsRoutes(
  app: FastifyInstance,
  monitoring: OperationsMonitoringService,
  routeAccess: AdminRouteAccess,
  options: { assets?: FrontendAssets } = {},
  serviceControl?: ServiceControlService,
  deliveries?: Pick<
    SupportRepository,
    | 'confirmUnknownDeliveryNotReceived'
    | 'confirmUnknownDeliveryReceived'
    | 'retryFailedDelivery'
  >,
  operatorInbox?: OperatorInboxService,
  usageMetrics?: Pick<SupportRepository, 'getUsageEventCounts'>,
  operatorActions?: Pick<OperatorActionIncidentService, 'resolve'>,
): void {
  const assets = options.assets ?? loadFrontendAssets('/ops');

  registerOperationsAssetRoutes(app, routeAccess, assets);
  registerOperationsStatusRoutes(app, monitoring, routeAccess);
  registerOperationsDeliveryRoutes(app, deliveries, routeAccess);
  registerOperatorActionRoutes(app, operatorActions, routeAccess);
  registerOperatorInboxRoutes(app, operatorInbox, routeAccess);
  registerUsageMetricsRoute(app, usageMetrics, routeAccess);
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
