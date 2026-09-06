import type { ClientIntakePolicy } from '@/core/contracts/client-intake-policy.js';
import type { OutboundDeliveryPolicy } from '@/core/contracts/outbound-delivery-policy.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';
import type { ServiceControlStore } from '@/modules/service-control/application/ports/service-control-store.js';
import {
  copyServiceControlState,
  type ServiceControlState,
} from '@/modules/service-control/model/service-control-state.js';

export class ServiceControlService
  implements ClientIntakePolicy, OutboundDeliveryPolicy
{
  private updateQueue: Promise<void> = Promise.resolve();

  public constructor(
    initialState: ServiceControlState,
    private readonly store: ServiceControlStore,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.state = copyServiceControlState(initialState);
  }

  private state: ServiceControlState;

  public getState(): ServiceControlState {
    return copyServiceControlState(this.state);
  }

  public isPaused(channel: ClientChannelKind): boolean {
    return this.state.channels[channel].mode === 'paused';
  }

  public isDeliveryPaused(): boolean {
    return this.state.delivery.mode === 'paused';
  }

  public pauseDelivery(): Promise<ServiceControlState> {
    return this.update((current) => ({
      ...current,
      delivery: {
        changedAt: this.clock().toISOString(),
        mode: 'paused',
      },
    }));
  }

  public resumeDelivery(): Promise<ServiceControlState> {
    return this.update((current) => ({
      ...current,
      delivery: {
        changedAt: this.clock().toISOString(),
        mode: 'active',
      },
    }));
  }

  public pause(channel: ClientChannelKind): Promise<ServiceControlState> {
    return this.update((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [channel]: {
          changedAt: this.clock().toISOString(),
          mode: 'paused' as const,
        },
      },
    }));
  }

  public resume(channel: ClientChannelKind): Promise<ServiceControlState> {
    return this.update((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [channel]: {
          changedAt: this.clock().toISOString(),
          mode: 'active' as const,
        },
      },
    }));
  }

  private async update(
    change: (current: ServiceControlState) => ServiceControlState,
  ): Promise<ServiceControlState> {
    let result: ServiceControlState | undefined;
    const operation = this.updateQueue.then(async () => {
      const next = change(copyServiceControlState(this.state));
      await this.store.save(next);
      this.state = copyServiceControlState(next);
      result = this.getState();
    });
    this.updateQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    await operation;
    return result ?? this.getState();
  }
}
