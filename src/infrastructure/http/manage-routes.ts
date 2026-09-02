import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { contentInputSchema, normalizeContentInput } from './content-input.js';
import type { ContentManagementAccess } from './content-management-access.js';
import type { ContentSetupController } from './content-setup-controller.js';
import {
  managePageHtml,
  managePageScript,
  managePageStyles,
} from './manage-page.js';

const passwordSchema = z.object({
  password: z.string().min(1).max(200),
});
const sessionMaxAgeSeconds = 12 * 60 * 60;

interface ManagementRouteOptions {
  allowLocalBypass: boolean;
  secureCookies: boolean;
}

export function registerManagementRoutes(
  app: FastifyInstance,
  content: ContentSetupController,
  access: ContentManagementAccess,
  options: ManagementRouteOptions,
): void {
  const cookieName = options.secureCookies
    ? '__Host-mh-content-session'
    : 'mh-content-session';

  const isAvailable = (request: FastifyRequest): boolean =>
    access.isConfigured() ||
    (options.allowLocalBypass && isLoopback(request.ip));
  const isAuthorized = (request: FastifyRequest): boolean =>
    (options.allowLocalBypass && isLoopback(request.ip)) ||
    access.authenticate(readCookie(request.headers.cookie, cookieName));

  const requireAvailable = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    if (!isAvailable(request)) {
      return reply.code(404).send({ message: 'Not found' });
    }
  };
  const requireAuthorization = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    if (!isAvailable(request)) {
      return reply.code(404).send({ message: 'Not found' });
    }
    if (!isAuthorized(request)) {
      return reply
        .code(401)
        .send({ message: 'Войдите, чтобы изменить информацию.' });
    }
  };
  const requireSameOrigin = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const origin = request.headers.origin;
    if (!origin) return;
    try {
      if (new URL(origin).host !== request.headers.host) {
        return reply.code(403).send({ message: 'Запрос отклонён.' });
      }
    } catch {
      return reply.code(403).send({ message: 'Запрос отклонён.' });
    }
  };

  app.addHook('onSend', async (request, reply, payload) => {
    if (isManagementUrl(request.url)) {
      void reply.header('cache-control', 'no-store');
      void reply.header('referrer-policy', 'no-referrer');
      void reply.header('x-content-type-options', 'nosniff');
      void reply.header('x-frame-options', 'DENY');
    }
    return payload;
  });

  app.get(
    '/manage',
    { preHandler: requireAvailable },
    async (_request, reply) => {
      void reply.header(
        'content-security-policy',
        [
          `default-src 'none'`,
          `script-src 'self'`,
          `style-src 'self'`,
          `connect-src 'self'`,
          `frame-ancestors 'none'`,
          `form-action 'self'`,
        ].join('; '),
      );
      return reply.type('text/html; charset=utf-8').send(managePageHtml);
    },
  );
  app.get(
    '/manage/app.js',
    { preHandler: requireAvailable },
    async (_request, reply) =>
      reply
        .type('application/javascript; charset=utf-8')
        .send(managePageScript),
  );
  app.get(
    '/manage/style.css',
    { preHandler: requireAvailable },
    async (_request, reply) =>
      reply.type('text/css; charset=utf-8').send(managePageStyles),
  );

  app.get(
    '/api/manage/session',
    { preHandler: requireAvailable },
    (request) => ({ authenticated: isAuthorized(request) }),
  );

  app.post(
    '/api/manage/login',
    { preHandler: [requireAvailable, requireSameOrigin] },
    async (request, reply) => {
      if (options.allowLocalBypass && isLoopback(request.ip)) {
        return { authenticated: true };
      }
      const parsed = passwordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(401).send({ message: 'Неверный пароль.' });
      }
      const result = access.login(parsed.data.password, request.ip);
      if (result.kind === 'invalid') {
        return reply.code(401).send({ message: 'Неверный пароль.' });
      }
      if (result.kind === 'blocked') {
        void reply.header('retry-after', String(result.retryAfterSeconds));
        return reply.code(429).send({
          message: 'Слишком много попыток. Попробуйте позже.',
        });
      }
      void reply.header(
        'set-cookie',
        createSessionCookie(
          cookieName,
          result.token,
          sessionMaxAgeSeconds,
          options.secureCookies,
        ),
      );
      return { authenticated: true };
    },
  );

  app.post(
    '/api/manage/logout',
    { preHandler: [requireAvailable, requireSameOrigin] },
    (request, reply) => {
      access.logout(readCookie(request.headers.cookie, cookieName));
      void reply.header(
        'set-cookie',
        createSessionCookie(cookieName, '', 0, options.secureCookies),
      );
      return { authenticated: false };
    },
  );

  app.get('/api/manage/content', { preHandler: requireAuthorization }, () =>
    content.get(),
  );
  app.get(
    '/api/manage/content/history',
    { preHandler: requireAuthorization },
    async () => ({ history: await content.getHistory() }),
  );
  app.post(
    '/api/manage/content',
    { preHandler: [requireAuthorization, requireSameOrigin] },
    async (request, reply) => {
      const parsed = contentInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          message: 'Каждый раздел должен быть короче 4000 символов.',
        });
      }
      const normalized = normalizeContentInput(parsed.data);
      if (!normalized) {
        return reply.code(400).send({
          message:
            'Проверьте названия и тексты кнопок. Каждый частый вопрос должен содержать ответ.',
        });
      }
      try {
        await content.save(normalized);
        return { saved: true };
      } catch (error: unknown) {
        app.log.error({ err: error }, 'Managed content settings save failed');
        return reply.code(500).send({
          message: 'Не удалось сохранить информацию. Попробуйте ещё раз.',
        });
      }
    },
  );
}

function createSessionCookie(
  name: string,
  value: string,
  maxAge: number,
  secure: boolean,
): string {
  return [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

function readCookie(
  header: string | undefined,
  expectedName: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name === expectedName) return part.slice(separator + 1).trim();
  }
  return undefined;
}

function isManagementUrl(url: string): boolean {
  return (
    url === '/manage' ||
    url.startsWith('/manage/') ||
    url.startsWith('/api/manage/')
  );
}

function isLoopback(address: string): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}
