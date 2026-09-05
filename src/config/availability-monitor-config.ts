import { z } from 'zod';

const schema = z.object({
  MONITOR_HEALTH_URL: z.url().startsWith('https://'),
  MONITOR_INTERVAL_SECONDS: z.coerce.number().int().min(10).default(60),
  MONITOR_TELEGRAM_BOT_TOKEN: z.string().min(1),
  MONITOR_TELEGRAM_CHAT_ID: z.string().min(1),
  MONITOR_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(30).default(10),
});

export interface AvailabilityMonitorConfig {
  healthUrl: URL;
  intervalMs: number;
  telegramBotToken: string;
  telegramChatId: string;
  timeoutMs: number;
}

export function loadAvailabilityMonitorConfig(
  environment: NodeJS.ProcessEnv,
): AvailabilityMonitorConfig {
  const result = schema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      'Availability monitor requires an HTTPS health URL and Telegram alert credentials',
    );
  }
  return {
    healthUrl: new URL(result.data.MONITOR_HEALTH_URL),
    intervalMs: result.data.MONITOR_INTERVAL_SECONDS * 1_000,
    telegramBotToken: result.data.MONITOR_TELEGRAM_BOT_TOKEN,
    telegramChatId: result.data.MONITOR_TELEGRAM_CHAT_ID,
    timeoutMs: result.data.MONITOR_TIMEOUT_SECONDS * 1_000,
  };
}
