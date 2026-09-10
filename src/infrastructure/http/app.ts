import Fastify, { type FastifyInstance } from 'fastify';
import type { RuntimeConfig } from '@/config/runtime-config.js';

const loopbackTrustedProxies = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

export function createApp(config: RuntimeConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      base: { instanceId: config.instanceId },
      level: config.logLevel,
    },
    trustProxy: [...loopbackTrustedProxies, ...(config.trustedProxies ?? [])],
  });

  app.get('/health', () => ({ status: 'ok' }));

  return app;
}
