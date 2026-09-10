import { isIP } from 'node:net';

import { z } from 'zod';

import { instanceIdSchema } from '@/config/instance-id.js';

const telegramProxyUrlSchema = z
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'Telegram proxy URL must use HTTP or HTTPS')
  .refine((value) => {
    const url = new URL(value);
    return url.username === '' && url.password === '';
  }, 'Telegram proxy URL must not contain credentials');

const trustedProxiesSchema = z
  .string()
  .transform((value) => value.split(',').map((entry) => entry.trim()))
  .refine(
    (entries) => entries.length > 0 && entries.every(isValidProxyAddressOrCidr),
    'Trusted proxies must be a comma-separated list of IP addresses or CIDRs',
  );

const runtimeConfigSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  INSTANCE_ID: instanceIdSchema,
  HTTP_TRUSTED_PROXIES: optionalEnvironmentValue(trustedProxiesSchema),
  ADMIN_PASSWORD: optionalEnvironmentValue(z.string().min(12).max(200)),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_PATH: z.string().min(1).default('./data/inbox-point.sqlite'),
  CLOSED_REQUEST_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(7),
  TELEGRAM_BOT_TOKEN: optionalEnvironmentValue(z.string().min(20)),
  TELEGRAM_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  TELEGRAM_OPERATOR_CHAT_ID: optionalEnvironmentValue(
    z.coerce.number().int().safe().negative(),
  ),
  TELEGRAM_POLL_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(30),
  TELEGRAM_PROXY_URL: optionalEnvironmentValue(telegramProxyUrlSchema),
  VK_ACCESS_TOKEN: optionalEnvironmentValue(z.string().min(20)),
  VK_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  VK_GROUP_ID: optionalEnvironmentValue(z.coerce.number().int().positive()),
  VK_POLL_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(50).default(25),
});

export interface TelegramRuntimeConfig {
  botToken: string;
  operatorChatId: number;
  pollTimeoutSeconds: number;
}

export interface VkRuntimeConfig {
  accessToken: string;
  groupId: number;
  pollTimeoutSeconds: number;
}

export interface RuntimeConfig {
  adminPassword?: string;
  databasePath: string;
  closedRequestRetentionDays: number;
  host: string;
  instanceId: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  telegram?: TelegramRuntimeConfig;
  telegramProxyUrl?: URL;
  trustedProxies?: string[];
  vk?: VkRuntimeConfig;
}

export function loadRuntimeConfig(
  environment: NodeJS.ProcessEnv,
): RuntimeConfig {
  const result = runtimeConfigSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid runtime configuration: ${details}`);
  }

  if (
    result.data.TELEGRAM_ENABLED &&
    (!result.data.TELEGRAM_BOT_TOKEN ||
      result.data.TELEGRAM_OPERATOR_CHAT_ID === undefined)
  ) {
    throw new Error(
      'Invalid runtime configuration: Telegram requires TELEGRAM_BOT_TOKEN and TELEGRAM_OPERATOR_CHAT_ID',
    );
  }

  if (
    result.data.VK_ENABLED &&
    (!result.data.VK_ACCESS_TOKEN || result.data.VK_GROUP_ID === undefined)
  ) {
    throw new Error(
      'Invalid runtime configuration: VK requires VK_ACCESS_TOKEN and VK_GROUP_ID',
    );
  }

  return {
    ...(result.data.ADMIN_PASSWORD
      ? { adminPassword: result.data.ADMIN_PASSWORD }
      : {}),
    closedRequestRetentionDays: result.data.CLOSED_REQUEST_RETENTION_DAYS,
    databasePath: result.data.DATABASE_PATH,
    host: result.data.HOST,
    instanceId: result.data.INSTANCE_ID,
    logLevel: result.data.LOG_LEVEL,
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    ...(result.data.HTTP_TRUSTED_PROXIES
      ? { trustedProxies: result.data.HTTP_TRUSTED_PROXIES }
      : {}),
    ...(result.data.TELEGRAM_PROXY_URL
      ? { telegramProxyUrl: new URL(result.data.TELEGRAM_PROXY_URL) }
      : {}),
    ...(result.data.TELEGRAM_ENABLED
      ? {
          telegram: {
            botToken: result.data.TELEGRAM_BOT_TOKEN!,
            operatorChatId: result.data.TELEGRAM_OPERATOR_CHAT_ID!,
            pollTimeoutSeconds: result.data.TELEGRAM_POLL_TIMEOUT_SECONDS,
          },
        }
      : {}),
    ...(result.data.VK_ENABLED
      ? {
          vk: {
            accessToken: result.data.VK_ACCESS_TOKEN!,
            groupId: result.data.VK_GROUP_ID!,
            pollTimeoutSeconds: result.data.VK_POLL_TIMEOUT_SECONDS,
          },
        }
      : {}),
  };
}

function isValidProxyAddressOrCidr(value: string): boolean {
  const [address, prefix, ...unexpected] = value.split('/');
  if (!address || unexpected.length > 0) {
    return false;
  }

  const version = isIP(address);
  if (version === 0) {
    return false;
  }
  if (prefix === undefined) {
    return true;
  }
  if (!/^(0|[1-9]\d*)$/.test(prefix)) {
    return false;
  }

  const prefixLength = Number(prefix);
  return prefixLength <= (version === 4 ? 32 : 128);
}

function optionalEnvironmentValue<Output>(schema: z.ZodType<Output>) {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    schema.optional(),
  );
}
