import type { FastifyInstance } from 'fastify';

import type { AdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import {
  registerTelegramSetupRoutes,
  type TelegramSetupRouteController,
} from '@/modules/channel-setup/presentation/http/telegram-setup-routes.js';
import {
  registerVkSetupRoute,
  type VkSetupRouteController,
} from '@/modules/channel-setup/presentation/http/vk-setup-route.js';

interface ChannelSetupStatus {
  connected: boolean;
  locked: boolean;
  source: string;
}

interface TelegramSetup extends TelegramSetupRouteController {
  status(): ChannelSetupStatus;
}

interface VkSetup extends VkSetupRouteController {
  status(): ChannelSetupStatus;
}

export function registerSetupRoutes(
  app: FastifyInstance,
  telegramSetup: TelegramSetup,
  vkSetup: VkSetup | undefined,
  routeAccess: AdminRouteAccess,
): void {
  registerSetupStatusRoute(app, telegramSetup, vkSetup, routeAccess);
  registerTelegramSetupRoutes(
    app,
    telegramSetup,
    routeAccess,
    () => vkSetup?.status().source !== 'none',
  );
  registerVkSetupRoute(
    app,
    vkSetup,
    routeAccess,
    () => telegramSetup.status().connected,
  );
}

function registerSetupStatusRoute(
  app: FastifyInstance,
  telegramSetup: TelegramSetup,
  vkSetup: VkSetup | undefined,
  routeAccess: AdminRouteAccess,
): void {
  app.get(
    '/api/setup/status',
    { preHandler: routeAccess.requireAuthorization },
    () => ({
      ...telegramSetup.status(),
      vk: vkSetup?.status() ?? {
        connected: false,
        locked: true,
        source: 'none',
      },
    }),
  );
}
