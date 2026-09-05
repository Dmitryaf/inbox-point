export interface DeliveryWorkerActivityReporter {
  recordWorkerCycle(occurredAt: Date): void;
  recordWorkerStarted(occurredAt: Date): void;
  recordWorkerStopped(occurredAt: Date): void;
}

export const silentDeliveryWorkerActivityReporter: DeliveryWorkerActivityReporter =
  {
    recordWorkerCycle: () => undefined,
    recordWorkerStarted: () => undefined,
    recordWorkerStopped: () => undefined,
  };
