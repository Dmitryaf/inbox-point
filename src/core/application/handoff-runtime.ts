import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import { EmergencyOperatorInbox } from '@/core/application/emergency-operator-inbox.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import { SwitchableOperatorInbox } from '@/core/application/switchable-operator-inbox.js';
import type { ClientChannel } from '@/core/contracts/client-channel.js';
import type { DeliveryIncidentNotifier } from '@/core/contracts/delivery-incident-notifier.js';
import type { DeliveryWorkerActivityReporter } from '@/core/contracts/delivery-worker-activity-reporter.js';
import type { OperatorInbox } from '@/core/contracts/operator-inbox.js';
import type { OutboundDeliveryPolicy } from '@/core/contracts/outbound-delivery-policy.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { OperatorMessage } from '@/core/model/operator-message.js';
import type { SupportMessage } from '@/core/model/support-message.js';

export interface HandoffRuntimeDependencies {
  activity?: DeliveryWorkerActivityReporter;
  deliveryPolicy?: OutboundDeliveryPolicy;
  logger: { error(error: unknown, message: string): void };
  repository: SupportRepository;
}

export class HandoffRuntime {
  private abortController: AbortController | undefined;
  private readonly deliveryWorker: DeliveryWorker;
  private deliveryPromise: Promise<void> | undefined;
  private readonly handoffService: HandoffService;
  private readonly logger: HandoffRuntimeDependencies['logger'];
  private readonly operatorInbox: SwitchableOperatorInbox;

  public constructor(dependencies: HandoffRuntimeDependencies) {
    this.logger = dependencies.logger;
    this.operatorInbox = new SwitchableOperatorInbox(
      new EmergencyOperatorInbox(),
      (error, operation) =>
        dependencies.logger.error(
          error,
          `Operator inbox ${operation} failed; using emergency web inbox`,
        ),
    );
    this.handoffService = new HandoffService({
      operatorInbox: this.operatorInbox,
      repository: dependencies.repository,
    });
    this.deliveryWorker = new DeliveryWorker({
      ...(dependencies.activity ? { activity: dependencies.activity } : {}),
      channels: [],
      incidentNotifier: this.operatorInbox,
      onNotificationError: (error, deliveryId) =>
        dependencies.logger.error(
          error,
          `Delivery ${deliveryId} operator notification failed; retrying`,
        ),
      onError: (error, context) =>
        dependencies.logger.error(
          error,
          context.final
            ? `Delivery ${context.deliveryId} failed permanently after ${context.attempt} attempts`
            : `Delivery ${context.deliveryId} failed on attempt ${context.attempt}; retrying`,
        ),
      ...(dependencies.deliveryPolicy
        ? { policy: dependencies.deliveryPolicy }
        : {}),
      repository: dependencies.repository,
    });
  }

  public get running(): boolean {
    return this.abortController !== undefined;
  }

  public handleClientMessage(
    externalEventId: string,
    message: SupportMessage,
  ): Promise<void> {
    return this.handoffService.handleClientMessage(externalEventId, message);
  }

  public handleOperatorMessage(
    externalEventId: string,
    message: OperatorMessage,
  ): Promise<void> {
    return this.handoffService.handleOperatorMessage(externalEventId, message);
  }

  public handleWebOperatorMessage(
    externalEventId: string,
    message: OperatorMessage,
  ): Promise<void> {
    return this.handoffService.handleOperatorMessage(
      externalEventId,
      message,
      'operator:web',
    );
  }

  public handleOperatorTopicClosed(
    externalEventId: string,
    operatorTopicId: string,
    occurredAt: Date,
  ): Promise<void> {
    return this.handoffService.handleOperatorTopicClosed(
      externalEventId,
      operatorTopicId,
      occurredAt,
    );
  }

  public handleOperatorTopicReopened(
    externalEventId: string,
    operatorTopicId: string,
  ): Promise<void> {
    return this.handoffService.handleOperatorTopicReopened(
      externalEventId,
      operatorTopicId,
    );
  }

  public registerClientChannel(channel: ClientChannel): () => void {
    this.deliveryWorker.registerChannel(channel);
    return () => this.deliveryWorker.unregisterChannel(channel);
  }

  public registerOperatorInbox(
    inbox: OperatorInbox & DeliveryIncidentNotifier,
  ): () => void {
    return this.operatorInbox.register(inbox);
  }

  public start(): void {
    if (this.running) {
      return;
    }
    const abortController = new AbortController();
    this.abortController = abortController;
    this.deliveryPromise = this.deliveryWorker
      .run(abortController.signal)
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          this.abortController = undefined;
          this.logger.error(error, 'Delivery worker stopped unexpectedly');
        }
      });
  }

  public async stop(): Promise<void> {
    const abortController = this.abortController;
    const deliveryPromise = this.deliveryPromise;
    this.abortController = undefined;
    this.deliveryPromise = undefined;
    abortController?.abort();
    await deliveryPromise;
  }
}
