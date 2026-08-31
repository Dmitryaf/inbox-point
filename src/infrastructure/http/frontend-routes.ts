import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';

export function registerFrontendRoutes(app: FastifyInstance): void {
  const root = resolve('dist/frontend');
  app.get('/', async (_, reply) =>
    reply
      .type('text/html; charset=utf-8')
      .send(await readFile(resolve(root, 'index.html'))),
  );
  app.get('/app.js', async (_, reply) =>
    reply
      .type('text/javascript; charset=utf-8')
      .send(await readFile(resolve(root, 'app.js'))),
  );
  app.get('/style.css', async (_, reply) =>
    reply
      .type('text/css; charset=utf-8')
      .send(await readFile(resolve(root, 'style.css'))),
  );
}
