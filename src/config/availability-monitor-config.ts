import { z } from 'zod';

import { instanceIdSchema } from '@/config/instance-id.js';

const schema = z.object({
  INSTANCE_ID: instanceIdSchema,
  MONITOR_ALERT_BEARER_TOKEN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).max(500).optional(),
  ),
  MONITOR_ALERT_WEBHOOK_URL: z.url().startsWith('https://'),
  MONITOR_INTERVAL_SECONDS: z.coerce.number().int().min(10).default(60),
  MONITOR_READINESS_URL: z
    .url()
    .startsWith('https://')
    .refine((value) => new URL(value).pathname.endsWith('/ready')),
  MONITOR_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(30).default(10),
});

export interface AvailabilityMonitorConfig {
  alertBearerToken?: string;
  alertWebhookUrl: URL;
  intervalMs: number;
  instanceId: string;
  readinessUrl: URL;
  timeoutMs: number;
}

export function loadAvailabilityMonitorConfig(
  environment: NodeJS.ProcessEnv,
): AvailabilityMonitorConfig {
  const result = schema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      'Availability monitor requires an HTTPS /ready URL and an independent HTTPS alert webhook',
    );
  }
  return {
    ...(result.data.MONITOR_ALERT_BEARER_TOKEN
      ? { alertBearerToken: result.data.MONITOR_ALERT_BEARER_TOKEN }
      : {}),
    alertWebhookUrl: new URL(result.data.MONITOR_ALERT_WEBHOOK_URL),
    intervalMs: result.data.MONITOR_INTERVAL_SECONDS * 1_000,
    instanceId: result.data.INSTANCE_ID,
    readinessUrl: new URL(result.data.MONITOR_READINESS_URL),
    timeoutMs: result.data.MONITOR_TIMEOUT_SECONDS * 1_000,
  };
}
