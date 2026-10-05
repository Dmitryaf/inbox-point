import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { RuntimeConfig } from '@/config/runtime-config.js';
import { serializeSafeError } from '@/infrastructure/diagnostics/api-request-diagnostic.js';
import { SafeLogController } from './safe-log-controller.js';

const loopbackTrustedProxies = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

export function createApp(
  config: RuntimeConfig,
  logStream?: { write(line: string): void },
): FastifyInstance {
  const app = Fastify({
    logController: new SafeLogController(),
    logger: {
      base: { instanceId: config.instanceId },
      level: config.logLevel,
      ...(logStream ? { stream: logStream } : {}),
      serializers: {
        err: serializeSafeError,
        req: (request: FastifyRequest) => ({
          method: request.method,
          route: request.routeOptions?.url,
        }),
      },
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
    },
    trustProxy: [...loopbackTrustedProxies, ...(config.trustedProxies ?? [])],
  });

  app.get('/health', () => ({ status: 'ok' }));

  return app;
}
