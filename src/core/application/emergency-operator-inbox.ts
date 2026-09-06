import type {
  OpenOperatorRequest,
  OperatorInbox,
  RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import {
  createWebOperatorTopicId,
  isWebOperatorTopic,
} from '@/core/model/operator-topic.js';
import type { SupportMessage } from '@/core/model/support-message.js';

export class EmergencyOperatorInbox implements OperatorInbox {
  public closeRequest(): Promise<void> {
    return Promise.resolve();
  }

  public openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    return Promise.resolve({
      topicId: createWebOperatorTopicId(request.requestId),
    });
  }

  public relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ): Promise<{
    operatorMessageIds: readonly string[];
    operatorTopicId: string;
  }> {
    return Promise.resolve({
      operatorMessageIds: [
        `web:${message.channel}:${message.externalMessageId}`,
      ],
      operatorTopicId: isWebOperatorTopic(operatorTopicId)
        ? operatorTopicId
        : createWebOperatorTopicId(options.requestId),
    });
  }

  public reopenRequest(): Promise<void> {
    return Promise.resolve();
  }
}
