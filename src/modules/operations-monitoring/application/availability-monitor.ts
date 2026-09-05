import { waitForDelay } from '@/core/application/wait-for-delay.js';

export interface AvailabilityChecker {
  check(): Promise<void>;
}

export interface AvailabilityAlert {
  send(message: string): Promise<void>;
}

export interface AvailabilityMonitorLogger {
  error(error: unknown, message: string): void;
  info(message: string): void;
}

export class AvailabilityMonitor {
  private outageAlertSent = false;
  private state: 'available' | 'unknown' | 'unavailable' = 'unknown';

  public constructor(
    private readonly checker: AvailabilityChecker,
    private readonly alert: AvailabilityAlert,
    private readonly logger: AvailabilityMonitorLogger,
    private readonly intervalMs: number,
  ) {}

  public async checkOnce(): Promise<void> {
    try {
      await this.checker.check();
      if (this.state === 'unavailable' && this.outageAlertSent) {
        await this.sendAlert('Messenger Handoff снова доступен.');
      }
      this.state = 'available';
      this.outageAlertSent = false;
    } catch (error: unknown) {
      this.logger.error(error, 'Messenger Handoff availability check failed');
      if (this.state !== 'unavailable') {
        this.outageAlertSent = false;
      }
      if (!this.outageAlertSent) {
        this.outageAlertSent = await this.sendAlert(
          'Messenger Handoff недоступен. Проверьте сервер и контейнер приложения.',
        );
      }
      this.state = 'unavailable';
    }
  }

  public async run(signal: AbortSignal): Promise<void> {
    this.logger.info('Messenger Handoff external availability monitor started');
    while (!signal.aborted) {
      await this.checkOnce();
      await waitForDelay(this.intervalMs, signal);
    }
  }

  private async sendAlert(message: string): Promise<boolean> {
    try {
      await this.alert.send(message);
      return true;
    } catch (error: unknown) {
      this.logger.error(error, 'Availability alert delivery failed');
      return false;
    }
  }
}
