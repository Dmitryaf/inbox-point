import type { DeliveryWorkerActivityReporter } from '@/core/contracts/delivery-worker-activity-reporter.js';

export interface DeliveryWorkerActivitySnapshot {
  lastCycleAt?: Date;
  lastStartedAt?: Date;
  lastStoppedAt?: Date;
  running: boolean;
}

export class DeliveryWorkerActivityMonitor implements DeliveryWorkerActivityReporter {
  private activity: DeliveryWorkerActivitySnapshot = { running: false };

  public recordWorkerCycle(occurredAt: Date): void {
    this.activity = { ...this.activity, lastCycleAt: occurredAt };
  }

  public recordWorkerStarted(occurredAt: Date): void {
    this.activity = {
      ...this.activity,
      lastStartedAt: occurredAt,
      running: true,
    };
  }

  public recordWorkerStopped(occurredAt: Date): void {
    this.activity = {
      ...this.activity,
      lastStoppedAt: occurredAt,
      running: false,
    };
  }

  public snapshot(): DeliveryWorkerActivitySnapshot {
    return { ...this.activity };
  }
}
