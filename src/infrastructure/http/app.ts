import Fastify, { type FastifyInstance } from 'fastify';
import type { RuntimeConfig } from '@/config/runtime-config.js';

export function createApp(config: RuntimeConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    trustProxy: (address, hop) => hop === 0 && isLoopback(address),
  });

  app.get('/health', () => ({ status: 'ok' }));

  return app;
}

function isLoopback(address: string): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}
