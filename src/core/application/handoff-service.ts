import { randomUUID } from 'node:crypto';

import { KeyedTaskQueue } from '@/core/application/keyed-task-queue.js';
import { enqueueHandoffAcknowledgement } from '@/core/application/handoff-acknowledgement.js';
import {
  OperatorActionOutcomeUnknownError,
  OperatorConversationOwnershipConflictError,
  OperatorConversationUnavailableError,
  type OperatorInbox,
} from '@/core/contracts/operator-inbox.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type {
  ChannelOperatorMessage,
  OperatorMessage,
} from '@/core/model/operator-message.js';
import { createOperatorLifecycleAction } from '@/core/model/operator-action.js';
import {
  createWebOperatorTopicId,
  isWebOperatorTopic,
  requestIdFromWebOperatorTopic,
} from '@/core/model/operator-topic.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import type {
  ConversationMessage,
  SupportRequest,
} from '@/core/model/support-request.js';

export interface HandoffServiceDependencies {
  clock?: () => Date;
  createId?: () => string;
  operatorInbox: OperatorInbox;
  repository: SupportRepository;
}

export class HandoffService {
  private readonly conversationMutationQueue = new KeyedTaskQueue();
  private readonly clock: () => Date;
  private readonly createId: () => string;
  private readonly operatorInbox: OperatorInbox;
  private readonly repository: SupportRepository;

  public constructor(dependencies: HandoffServiceDependencies) {
    this.clock = dependencies.clock ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
    this.operatorInbox = dependencies.operatorInbox;
    this.repository = dependencies.repository;
  }

  public async handleClientMessage(
    externalEventId: string,
    message: SupportMessage,
  ): Promise<void> {
    const conversationKey = createConversationKey(message);

    await this.conversationMutationQueue.run(conversationKey, async () => {
      await this.handleEvent(
        `client:${message.channel}`,
        externalEventId,
        async () => {
          await this.processClientMessage(message);
        },
      );
    });
  }

  public async recoverWebRequests(
    operatorInbox: OperatorInbox,
    limit = 50,
  ): Promise<void> {
    const failures: unknown[] = [];
    const requests = this.repository.findRecoverableWebOperatorRequests(limit);

    for (const request of requests) {
      const conversationKey = createConversationKey(request);
      try {
        await this.conversationMutationQueue.run(conversationKey, async () => {
          await this.recoverWebRequest(request.id, operatorInbox);
        });
      } catch (error: unknown) {
        failures.push(error);
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        'One or more emergency web requests could not be delivered to Telegram',
      );
    }
  }

  private async recoverWebRequest(
    requestId: string,
    operatorInbox: OperatorInbox,
  ): Promise<void> {
    const request = this.repository.findRequestById(requestId);
    if (
      request?.status !== 'active' ||
      !isWebOperatorTopic(request.operatorTopicId)
    ) {
      return;
    }

    const messages = this.repository.findConversationMessages(request.id);
    const clientMessages = messages.filter(
      (message) => message.direction === 'client_to_operator',
    );
    const firstMessage = clientMessages[0];
    if (!firstMessage) {
      return;
    }

    const source = createRecoveredSupportMessage(request, firstMessage);
    let opened = await operatorInbox.openRequest({
      requestId: request.id,
      source,
      title: createTopicTitle(request.channel, source.displayName),
    });
    if (isWebOperatorTopic(opened.topicId)) {
      throw new Error('Emergency request recovery did not reach Telegram');
    }

    try {
      if (
        !(await this.recoverMessagesIntoTopic(
          request,
          clientMessages,
          operatorInbox,
          opened.topicId,
        ))
      ) {
        await this.closeAbandonedRecoveryTopic(
          request.id,
          opened.topicId,
          operatorInbox,
        );
        return;
      }
    } catch (error: unknown) {
      if (!(error instanceof OperatorConversationUnavailableError)) {
        throw error;
      }
      opened = await operatorInbox.openRequest({
        expectedTopicId: request.operatorTopicId,
        requestId: request.id,
        source,
        title: createTopicTitle(request.channel, source.displayName),
        unavailableTopicId: opened.topicId,
      });
      if (isWebOperatorTopic(opened.topicId)) {
        throw new Error('Emergency request recovery did not reach Telegram');
      }
      if (
        !(await this.recoverMessagesIntoTopic(
          request,
          clientMessages,
          operatorInbox,
          opened.topicId,
          opened.topicId,
        ))
      ) {
        await this.closeAbandonedRecoveryTopic(
          request.id,
          opened.topicId,
          operatorInbox,
        );
        return;
      }
    }

    enqueueHandoffAcknowledgement(
      this.repository,
      request,
      this.clock(),
      'recovered',
    );
  }

  private async recoverMessagesIntoTopic(
    request: SupportRequest,
    clientMessages: readonly ConversationMessage[],
    operatorInbox: OperatorInbox,
    operatorTopicId: string,
    actionScope?: string,
  ): Promise<boolean> {
    const current = this.repository.findRequestById(request.id);
    if (current?.status !== 'active') {
      return false;
    }
    if (current.operatorTopicId === request.operatorTopicId) {
      const switched = this.repository.recoverWebOperatorRequest(
        request.id,
        request.operatorTopicId,
        operatorTopicId,
      );
      if (!switched) {
        return false;
      }
    } else if (current.operatorTopicId !== operatorTopicId) {
      return false;
    }

    try {
      for (const [index, message] of clientMessages.entries()) {
        const recoveredMessage = createRecoveredSupportMessage(
          request,
          message,
        );
        const relayed = await operatorInbox.relayCustomerMessage(
          operatorTopicId,
          recoveredMessage,
          {
            ...(actionScope ? { actionScope } : {}),
            initial: index === 0,
            requestId: request.id,
          },
        );
        if (relayed.operatorTopicId !== operatorTopicId) {
          throw new Error('The recovered operator topic changed unexpectedly');
        }
        for (const operatorMessageId of relayed.operatorMessageIds) {
          this.repository.ensureMessageLink({
            clientMessageId: message.externalMessageId,
            createdAt: this.clock(),
            direction: 'client_to_operator',
            id: this.createId(),
            operatorMessageId,
            requestId: request.id,
          });
        }
      }
      return true;
    } catch (error: unknown) {
      if (!(error instanceof OperatorActionOutcomeUnknownError)) {
        this.repository.switchOperatorTopic(
          request.id,
          operatorTopicId,
          request.operatorTopicId,
        );
      }
      throw error;
    }
  }

  private async closeAbandonedRecoveryTopic(
    requestId: string,
    operatorTopicId: string,
    operatorInbox: OperatorInbox,
  ): Promise<void> {
    try {
      await operatorInbox.closeRequest(operatorTopicId, {
        externalEventId: `recovery-conflict:${operatorTopicId}`,
        requestId,
      });
    } catch (error: unknown) {
      if (!(error instanceof OperatorActionOutcomeUnknownError)) {
        throw error;
      }
    }
  }

  private async processClientMessage(message: SupportMessage): Promise<void> {
    const existingRequest = this.repository.findActiveRequest(
      message.channel,
      message.conversationId,
    );

    if (existingRequest) {
      if (isWebOperatorTopic(existingRequest.operatorTopicId)) {
        this.recordWebTakeover(existingRequest.id, message.channel);
      }
      try {
        await this.relayClientMessage(existingRequest, message);
        return;
      } catch (error: unknown) {
        if (error instanceof OperatorActionOutcomeUnknownError) {
          return;
        }
        if (!(error instanceof OperatorConversationUnavailableError)) {
          throw error;
        }
        this.repository.closeRequest(existingRequest.id, this.clock());
        await this.openClientRequest(message);
        return;
      }
    }

    const latestRequest = this.repository.findLatestRequest(
      message.channel,
      message.conversationId,
    );
    if (
      latestRequest &&
      !this.repository.isAwaitingClientQuestion(
        message.channel,
        message.conversationId,
        this.clock(),
      )
    ) {
      return;
    }

    await this.openClientRequest(message);
  }

  private async relayClientMessage(
    request: {
      id: string;
      operatorTopicId: string;
    },
    message: SupportMessage,
    initial = false,
  ): Promise<void> {
    this.repository.recordConversationMessage({
      createdAt: message.receivedAt,
      direction: 'client_to_operator',
      externalMessageId: message.externalMessageId,
      id: this.createId(),
      requestId: request.id,
      senderName: message.displayName,
      text: message.text,
    });
    const relayed = await this.operatorInbox.relayCustomerMessage(
      request.operatorTopicId,
      message,
      { initial, requestId: request.id },
    );
    if (relayed.operatorTopicId !== request.operatorTopicId) {
      const switched = this.repository.switchOperatorTopic(
        request.id,
        request.operatorTopicId,
        relayed.operatorTopicId,
      );
      if (!switched) {
        const current = this.repository.findRequestById(request.id);
        if (current?.operatorTopicId !== relayed.operatorTopicId) {
          throw new Error('The operator surface changed concurrently');
        }
      }
      if (
        isWebOperatorTopic(relayed.operatorTopicId) &&
        !isWebOperatorTopic(request.operatorTopicId)
      ) {
        this.recordWebTakeover(request.id, message.channel);
      }
    }
    for (const operatorMessageId of relayed.operatorMessageIds) {
      this.repository.ensureMessageLink({
        clientMessageId: message.externalMessageId,
        createdAt: this.clock(),
        direction: 'client_to_operator',
        id: this.createId(),
        operatorMessageId,
        requestId: request.id,
      });
    }
    enqueueHandoffAcknowledgement(
      this.repository,
      {
        channel: message.channel,
        conversationId: message.conversationId,
        id: request.id,
      },
      this.clock(),
      isWebOperatorTopic(relayed.operatorTopicId) ? 'delayed' : 'sent',
    );
  }

  private async openClientRequest(message: SupportMessage): Promise<void> {
    const requestId = this.createId();
    const createdAt = this.clock();
    const webTopicId = createWebOperatorTopicId(requestId);
    const latestRequest = this.repository.findLatestRequest(
      message.channel,
      message.conversationId,
    );
    const reusableTopicId =
      latestRequest && !isWebOperatorTopic(latestRequest.operatorTopicId)
        ? latestRequest.operatorTopicId
        : undefined;

    const created = this.repository.createNextRequest({
      channel: message.channel,
      conversationId: message.conversationId,
      createdAt,
      displayName: message.displayName,
      id: requestId,
      operatorTopicId: webTopicId,
      status: 'active',
    });
    if (!created) {
      await this.processClientMessage(message);
      return;
    }
    this.repository.recordConversationMessage({
      createdAt: message.receivedAt,
      direction: 'client_to_operator',
      externalMessageId: message.externalMessageId,
      id: this.createId(),
      requestId,
      senderName: message.displayName,
      text: message.text,
    });
    this.repository.recordUsageEvent({
      channel: message.channel,
      id: `new-request:${requestId}`,
      occurredAt: createdAt,
      requestId,
      type: 'new_request',
    });
    let opened: { topicId: string };
    try {
      opened = await this.operatorInbox.openRequest({
        requestId,
        ...(reusableTopicId ? { reusableTopicId } : {}),
        source: message,
        title: createTopicTitle(message.channel, message.displayName),
      });
    } catch (error: unknown) {
      if (!(error instanceof OperatorActionOutcomeUnknownError)) {
        throw error;
      }
      this.recordWebTakeover(requestId, message.channel);
      enqueueHandoffAcknowledgement(
        this.repository,
        {
          channel: message.channel,
          conversationId: message.conversationId,
          id: requestId,
        },
        this.clock(),
        'delayed',
      );
      return;
    }
    if (opened.topicId !== webTopicId) {
      const switched = this.repository.switchOperatorTopic(
        requestId,
        webTopicId,
        opened.topicId,
      );
      if (!switched) {
        const current = this.repository.findRequestById(requestId);
        if (current?.operatorTopicId !== opened.topicId) {
          throw new Error('The operator surface changed concurrently');
        }
      }
    }
    if (isWebOperatorTopic(opened.topicId)) {
      this.recordWebTakeover(requestId, message.channel);
    }
    try {
      await this.relayClientMessage(
        { id: requestId, operatorTopicId: opened.topicId },
        message,
        true,
      );
    } catch (error: unknown) {
      if (!(error instanceof OperatorActionOutcomeUnknownError)) {
        throw error;
      }
    }
  }

  public async handleOperatorMessage(
    externalEventId: string,
    message: OperatorMessage,
    source = 'operator:telegram',
  ): Promise<void> {
    const request = this.findRequestForOperatorMessage(message, source);
    const operation = () =>
      this.handleEvent(source, externalEventId, async () => {
        await this.processOperatorMessage(externalEventId, message, source);
      });

    if (!request) {
      await operation();
      return;
    }

    await this.conversationMutationQueue.run(
      createConversationKey(request),
      operation,
    );
  }

  public async handleChannelOperatorMessage(
    externalEventId: string,
    message: ChannelOperatorMessage,
  ): Promise<void> {
    await this.conversationMutationQueue.run(
      createConversationKey(message),
      () =>
        this.handleEvent(
          `operator:${message.channel}:native`,
          externalEventId,
          async () => {
            try {
              await this.processChannelOperatorMessage(message);
            } catch (error: unknown) {
              if (!(error instanceof OperatorActionOutcomeUnknownError)) {
                throw error;
              }
            }
          },
        ),
    );
  }

  private async processChannelOperatorMessage(
    message: ChannelOperatorMessage,
  ): Promise<void> {
    const request =
      this.repository.findRequestByChannelOperatorMessage(
        message.channel,
        message.conversationId,
        message.externalMessageId,
      ) ??
      this.repository.findActiveRequest(
        message.channel,
        message.conversationId,
      );
    if (!request) {
      return;
    }

    const occurredAt = this.clock();
    this.repository.recordUsageEvent({
      channel: request.channel,
      id: `first-reply:${request.id}`,
      occurredAt,
      requestId: request.id,
      type: 'first_reply',
    });
    this.repository.recordConversationMessage({
      createdAt: message.receivedAt,
      direction: 'operator_to_client',
      externalMessageId: message.externalMessageId,
      id: this.createId(),
      requestId: request.id,
      text: message.text,
    });
    try {
      await this.operatorInbox.mirrorOperatorMessage(
        request.operatorTopicId,
        message,
        { requestId: request.id },
      );
    } catch (error: unknown) {
      if (!(error instanceof OperatorConversationUnavailableError)) {
        throw error;
      }
      await this.replaceUnavailableTopicForOperatorMessage(request, message);
    }
  }

  private async replaceUnavailableTopicForOperatorMessage(
    request: SupportRequest,
    message: ChannelOperatorMessage,
  ): Promise<void> {
    const current = this.repository.findRequestById(request.id);
    if (
      current?.status !== 'active' ||
      current.operatorTopicId !== request.operatorTopicId
    ) {
      throw new OperatorConversationUnavailableError();
    }
    const clientMessages = this.repository
      .findConversationMessages(request.id)
      .filter((item) => item.direction === 'client_to_operator');
    const firstMessage = clientMessages[0];
    if (!firstMessage) {
      throw new OperatorConversationUnavailableError();
    }
    const source = createRecoveredSupportMessage(request, firstMessage);
    const opened = await this.operatorInbox.openRequest({
      requestId: request.id,
      source,
      title: createTopicTitle(request.channel, source.displayName),
      unavailableTopicId: request.operatorTopicId,
    });
    const afterOpen = this.repository.findRequestById(request.id);
    const switched =
      afterOpen?.operatorTopicId === opened.topicId ||
      this.repository.switchOperatorTopic(
        request.id,
        request.operatorTopicId,
        opened.topicId,
      );
    if (!switched) {
      await this.closeAbandonedRecoveryTopic(
        request.id,
        opened.topicId,
        this.operatorInbox,
      );
      throw new Error('The operator surface changed during topic replacement');
    }

    const actionScope = `replacement:${opened.topicId}`;
    for (const [index, clientMessage] of clientMessages.entries()) {
      const recoveredMessage = createRecoveredSupportMessage(
        request,
        clientMessage,
      );
      const relayed = await this.operatorInbox.relayCustomerMessage(
        opened.topicId,
        recoveredMessage,
        {
          actionScope,
          initial: index === 0,
          requestId: request.id,
        },
      );
      if (relayed.operatorTopicId !== opened.topicId) {
        throw new Error('The replacement operator topic changed unexpectedly');
      }
      for (const operatorMessageId of relayed.operatorMessageIds) {
        this.repository.ensureMessageLink({
          clientMessageId: clientMessage.externalMessageId,
          createdAt: this.clock(),
          direction: 'client_to_operator',
          id: this.createId(),
          operatorMessageId,
          requestId: request.id,
        });
      }
    }
    await this.operatorInbox.mirrorOperatorMessage(opened.topicId, message, {
      actionScope,
      requestId: request.id,
    });
  }

  private findRequestForOperatorMessage(
    message: OperatorMessage,
    source: string,
  ): SupportRequest | undefined {
    const request = this.repository.findRequestByTopicId(
      message.operatorTopicId,
    );
    if (request || source !== 'operator:web') {
      return request;
    }
    const requestId = requestIdFromWebOperatorTopic(message.operatorTopicId);
    return requestId ? this.repository.findRequestById(requestId) : undefined;
  }

  private async processOperatorMessage(
    externalEventId: string,
    message: OperatorMessage,
    source: string,
  ): Promise<void> {
    let request = this.repository.findRequestByTopicId(message.operatorTopicId);

    if (!request) {
      if (source === 'operator:web') {
        throw new OperatorConversationOwnershipConflictError();
      }
      return;
    }

    const occurredAt = this.clock();
    if (
      source === 'operator:web' &&
      (!isWebOperatorTopic(request.operatorTopicId) ||
        !this.repository.markWebOperatorOwned(
          request.id,
          request.operatorTopicId,
          occurredAt,
        ))
    ) {
      throw new OperatorConversationOwnershipConflictError();
    }

    const command = parseOperatorCommand(message.text);
    if (command === 'close') {
      try {
        await this.operatorInbox.closeRequest(request.operatorTopicId, {
          externalEventId,
          requestId: request.id,
        });
      } catch (error: unknown) {
        if (error instanceof OperatorActionOutcomeUnknownError) {
          return;
        }
        throw error;
      }
      this.repository.closeRequest(request.id, this.clock());
      return;
    }

    if (command === 'reopen') {
      if (!this.canReopenRequest(request)) {
        await this.closeUnexpectedlyOpenTopic(request, externalEventId);
        return;
      }
      try {
        await this.operatorInbox.reopenRequest(request.operatorTopicId, {
          externalEventId,
          requestId: request.id,
        });
      } catch (error: unknown) {
        if (error instanceof OperatorActionOutcomeUnknownError) {
          return;
        }
        throw error;
      }
      this.repository.reopenRequest(request.id);
      return;
    }

    if (request.status === 'closed') {
      if (!this.canReopenRequest(request)) {
        return;
      }
      const reopenAction = createOperatorLifecycleAction(
        'reopen_request',
        request.operatorTopicId,
        { externalEventId, requestId: request.id },
        occurredAt,
      );
      const heldBy = this.repository.holdOperatorReply(
        {
          createdAt: message.receivedAt,
          eventSource: source,
          externalEventId,
          externalMessageId: message.externalMessageId,
          id: `held-operator-message:${source}:${externalEventId}`,
          requestId: request.id,
          text: message.text,
        },
        reopenAction,
      );
      if (!heldBy) {
        const current = this.repository.findRequestById(request.id);
        if (current?.status !== 'active') {
          return;
        }
        request = current;
      } else {
        if (heldBy.status === 'sent') {
          if (
            !this.repository.completeHeldOperatorReopen(heldBy.id, this.clock())
          ) {
            throw new Error('Held operator reply could not be completed');
          }
          return;
        }
        if (
          heldBy.id !== reopenAction.id ||
          heldBy.status === 'outcome_unknown' ||
          heldBy.status === 'sending' ||
          heldBy.status === 'abandoned'
        ) {
          return;
        }
        try {
          await this.operatorInbox.reopenRequest(request.operatorTopicId, {
            externalEventId,
            requestId: request.id,
          });
        } catch (error: unknown) {
          if (!(error instanceof OperatorActionOutcomeUnknownError)) {
            this.repository.markOperatorActionFailed(
              heldBy.id,
              safeErrorMessage(error),
            );
          }
          return;
        }
        if (
          !this.repository.completeHeldOperatorReopen(heldBy.id, this.clock())
        ) {
          throw new Error('Held operator reply could not be completed');
        }
        return;
      }
    } else {
      this.repository.rejectOperatorLifecycleActionOutcome(
        request.id,
        'close_request',
        this.clock(),
      );
    }

    const idempotencyKey = `operator:${externalEventId}`;
    this.repository.recordUsageEvent({
      channel: request.channel,
      id: `first-reply:${request.id}`,
      occurredAt,
      requestId: request.id,
      type: 'first_reply',
    });
    this.repository.recordConversationMessage({
      createdAt: message.receivedAt,
      direction: 'operator_to_client',
      externalMessageId: message.externalMessageId,
      id: this.createId(),
      requestId: request.id,
      text: message.text,
    });
    this.repository.enqueueDelivery({
      channel: request.channel,
      conversationId: request.conversationId,
      createdAt: occurredAt,
      id: this.createId(),
      idempotencyKey,
      operatorMessageId: message.externalMessageId,
      requestId: request.id,
      text: message.text,
    });
  }

  public async retryHeldOperatorReply(actionId: string): Promise<boolean> {
    const incident = this.repository.findOperatorActionIncident(actionId);
    if (
      incident?.kind !== 'reopen_request' ||
      incident.heldReplyCount === 0 ||
      (incident.status !== 'failed' && incident.status !== 'abandoned')
    ) {
      return false;
    }
    const request = this.repository.findRequestById(incident.requestId);
    if (!request) {
      return false;
    }

    return this.conversationMutationQueue.run(
      createConversationKey(request),
      async () => {
        const currentIncident =
          this.repository.findOperatorActionIncident(actionId);
        const currentRequest = this.repository.findRequestById(
          incident.requestId,
        );
        if (
          currentIncident?.kind !== 'reopen_request' ||
          currentRequest?.status !== 'closed' ||
          currentIncident.heldReplyCount === 0 ||
          (currentIncident.status !== 'failed' &&
            currentIncident.status !== 'abandoned') ||
          !this.canReopenRequest(currentRequest)
        ) {
          return false;
        }
        try {
          await this.operatorInbox.reopenRequest(
            currentIncident.operatorTopicId,
            {
              externalEventId: currentIncident.clientMessageId,
              requestId: currentIncident.requestId,
            },
          );
        } catch (error: unknown) {
          if (!(error instanceof OperatorActionOutcomeUnknownError)) {
            this.repository.markOperatorActionFailed(
              currentIncident.id,
              safeErrorMessage(error),
            );
          }
          return true;
        }
        return this.repository.completeHeldOperatorReopen(
          currentIncident.id,
          this.clock(),
        );
      },
    );
  }

  private recordWebTakeover(
    requestId: string,
    channel: SupportMessage['channel'],
  ): void {
    this.repository.recordUsageEvent({
      channel,
      id: `web-takeover:${requestId}`,
      occurredAt: this.clock(),
      requestId,
      type: 'web_takeover',
    });
  }

  public async handleOperatorTopicClosed(
    externalEventId: string,
    operatorTopicId: string,
    occurredAt: Date,
  ): Promise<void> {
    const request = this.repository.findRequestByTopicId(operatorTopicId);
    const operation = () =>
      this.handleEvent('operator:telegram', externalEventId, () => {
        const request = this.repository.findRequestByTopicId(operatorTopicId);
        if (
          request &&
          topicEventCanAffectRequest(request.createdAt, occurredAt)
        ) {
          this.repository.closeRequest(request.id, occurredAt);
          this.repository.confirmOperatorLifecycleAction(
            request.id,
            'close_request',
            operatorTopicId,
            occurredAt,
          );
          this.repository.rejectOperatorLifecycleActionOutcome(
            request.id,
            'reopen_request',
            occurredAt,
          );
        }
        return Promise.resolve();
      });
    if (!request) {
      await operation();
      return;
    }
    await this.conversationMutationQueue.run(
      createConversationKey(request),
      operation,
    );
  }

  public async handleOperatorTopicReopened(
    externalEventId: string,
    operatorTopicId: string,
  ): Promise<void> {
    const request = this.repository.findRequestByTopicId(operatorTopicId);
    const operation = () =>
      this.handleEvent('operator:telegram', externalEventId, async () => {
        const request = this.repository.findRequestByTopicId(operatorTopicId);
        if (request) {
          if (this.canReopenRequest(request)) {
            this.repository.reopenRequest(request.id);
            this.repository.confirmOperatorLifecycleAction(
              request.id,
              'reopen_request',
              operatorTopicId,
              this.clock(),
            );
            this.repository.rejectOperatorLifecycleActionOutcome(
              request.id,
              'close_request',
              this.clock(),
            );
          } else {
            await this.closeUnexpectedlyOpenTopic(request, externalEventId);
          }
        }
      });
    if (!request) {
      await operation();
      return;
    }
    await this.conversationMutationQueue.run(
      createConversationKey(request),
      operation,
    );
  }

  private async closeUnexpectedlyOpenTopic(
    request: { id: string; operatorTopicId: string },
    externalEventId: string,
  ): Promise<void> {
    try {
      await this.operatorInbox.closeRequest(request.operatorTopicId, {
        externalEventId,
        requestId: request.id,
      });
    } catch (error: unknown) {
      if (!(error instanceof OperatorActionOutcomeUnknownError)) {
        throw error;
      }
    }
  }

  private canReopenRequest(request: {
    channel: SupportMessage['channel'];
    conversationId: string;
    id: string;
  }): boolean {
    const latest = this.repository.findLatestRequest(
      request.channel,
      request.conversationId,
    );
    const active = this.repository.findActiveRequest(
      request.channel,
      request.conversationId,
    );
    return latest?.id === request.id && (!active || active.id === request.id);
  }

  private async handleEvent(
    source: string,
    externalEventId: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    const claimed = this.repository.claimEvent(
      source,
      externalEventId,
      this.clock(),
    );
    if (!claimed) {
      return;
    }

    try {
      await operation();
      this.repository.completeEvent(source, externalEventId, this.clock());
    } catch (error: unknown) {
      this.repository.releaseEvent(source, externalEventId);
      throw error;
    }
  }
}

function createConversationKey(
  message: Pick<SupportMessage, 'channel' | 'conversationId'>,
): string {
  return `${message.channel}\u0000${message.conversationId}`;
}

function createRecoveredSupportMessage(
  request: SupportRequest,
  message: ConversationMessage,
): SupportMessage {
  return {
    channel: request.channel,
    conversationId: request.conversationId,
    displayName: message.senderName ?? request.displayName ?? 'Клиент',
    externalMessageId: message.externalMessageId,
    receivedAt: message.createdAt,
    text: message.text,
  };
}

function topicEventCanAffectRequest(
  requestCreatedAt: Date,
  eventOccurredAt: Date,
): boolean {
  const requestCreatedSecond = Math.floor(requestCreatedAt.getTime() / 1_000);
  const eventOccurredSecond = Math.floor(eventOccurredAt.getTime() / 1_000);
  return requestCreatedSecond <= eventOccurredSecond;
}

function createTopicTitle(
  channel: SupportMessage['channel'],
  displayName: string,
): string {
  const normalized = displayName.replaceAll(/\s+/g, ' ').trim();
  const suffix = normalized.length > 0 ? normalized : 'Customer';
  const prefix = channel === 'telegram' ? 'TG' : 'VK';
  return `${prefix} - ${suffix}`.slice(0, 128);
}

function parseOperatorCommand(text: string): 'close' | 'reopen' | undefined {
  const command = text
    .trim()
    .split(/\s+/, 1)[0]
    ?.split('@', 1)[0]
    ?.toLowerCase();

  if (command === '/close') {
    return 'close';
  }
  if (command === '/reopen') {
    return 'reopen';
  }
  return undefined;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unknown operator action error';
}
