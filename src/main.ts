import { loadRuntimeConfig } from '@/config/runtime-config.js';
import { createApp } from '@/infrastructure/http/app.js';

async function start(): Promise<void> {
  const config = loadRuntimeConfig(process.env);
  const app = createApp(config);

  const close = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
  };

  process.once('SIGINT', () => void close('SIGINT'));
  process.once('SIGTERM', () => void close('SIGTERM'));

  await app.listen({ host: config.host, port: config.port });
}

start().catch((error: unknown) => {
  console.error('Failed to start Messenger Handoff', error);
  process.exitCode = 1;
});
