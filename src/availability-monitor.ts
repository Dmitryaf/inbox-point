import { loadAvailabilityMonitorConfig } from '@/config/availability-monitor-config.js';
import { HttpAvailabilityChecker } from '@/infrastructure/monitoring/http-availability-checker.js';
import { WebhookAvailabilityAlert } from '@/infrastructure/monitoring/webhook-availability-alert.js';
import { AvailabilityMonitor } from '@/modules/operations-monitoring/application/availability-monitor.js';

const config = loadAvailabilityMonitorConfig(process.env);
const abortController = new AbortController();
const monitor = new AvailabilityMonitor(
  new HttpAvailabilityChecker(config.readinessUrl, config.timeoutMs),
  new WebhookAvailabilityAlert(
    config.alertWebhookUrl,
    config.timeoutMs,
    config.alertBearerToken,
  ),
  console,
  config.intervalMs,
);

process.once('SIGINT', () => abortController.abort());
process.once('SIGTERM', () => abortController.abort());

monitor.run(abortController.signal).catch((error: unknown) => {
  console.error('Availability monitor stopped unexpectedly', error);
  process.exitCode = 1;
});
