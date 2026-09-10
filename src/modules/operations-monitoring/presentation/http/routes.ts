import type { FastifyInstance } from 'fastify';

import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { OperatorActionIncidentService } from '@/core/application/operator-action-incident-service.js';
import type { InboundEventIncidentService } from '@/core/application/inbound-event-incident-service.js';
import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerFrontendAssetRoutes } from '@/infrastructure/http/frontend-asset-routes.js';
import {
  loadFrontendAssets,
  type FrontendAssets,
} from '@/infrastructure/http/frontend-assets.js';
import type { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import type { OperatorInboxService } from '@/modules/operator-inbox/application/operator-inbox-service.js';
import { registerOperatorInboxRoutes } from '@/modules/operator-inbox/presentation/http/operator-inbox-routes.js';
import type { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';
import { registerServiceControlRoutes } from '@/modules/service-control/presentation/http/service-control-routes.js';
import { registerOperationsDeliveryRoutes } from './delivery-routes.js';
import { registerOperationsStatusRoutes } from './status-routes.js';
import { registerOperatorActionRoutes } from './operator-action-routes.js';
import { registerInboundEventRoutes } from './inbound-event-routes.js';
import { registerUsageMetricsRoute } from './usage-metrics-route.js';

interface OperationsRouteDependencies {
  assets?: FrontendAssets;
  deliveries?: Pick<
    SupportRepository,
    | 'confirmUnknownDeliveryNotReceived'
    | 'confirmUnknownDeliveryReceived'
    | 'retryFailedDelivery'
  >;
  inboundEvents?: Pick<InboundEventIncidentService, 'resolve'>;
  monitoring: OperationsMonitoringService;
  operatorActions?: Pick<OperatorActionIncidentService, 'resolve'>;
  operatorInbox?: OperatorInboxService;
  serviceControl?: ServiceControlService;
  usageMetrics?: Pick<SupportRepository, 'getUsageEventCounts'>;
}

export function registerOperationsRoutes(
  app: FastifyInstance,
  routeAccess: AdminRouteAccess,
  dependencies: OperationsRouteDependencies,
): void {
  const assets = dependencies.assets ?? loadFrontendAssets('/ops');

  registerFrontendAssetRoutes(app, routeAccess, {
    assets,
    basePath: '/ops',
    pagePaths: ['/ops'],
  });
  registerOperationsStatusRoutes(app, dependencies.monitoring, routeAccess);
  registerOperationsDeliveryRoutes(app, dependencies.deliveries, routeAccess);
  registerOperatorActionRoutes(app, dependencies.operatorActions, routeAccess);
  registerInboundEventRoutes(app, dependencies.inboundEvents, routeAccess);
  registerOperatorInboxRoutes(app, dependencies.operatorInbox, routeAccess);
  registerUsageMetricsRoute(app, dependencies.usageMetrics, routeAccess);
  if (dependencies.serviceControl) {
    registerServiceControlRoutes(
      app,
      dependencies.serviceControl,
      routeAccess,
      '/api/ops/service-control',
      true,
    );
  }
}
