import type {
  OpenOperatorRequest,
  OperatorInbox,
} from '@/core/contracts/operator-inbox.js';
import type { SupportMessage } from '@/core/model/support-message.js';

export class EmergencyOperatorInbox implements OperatorInbox {
  public closeRequest(): Promise<void> {
    return Promise.resolve();
  }

  public openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    return Promise.resolve({ topicId: `web:${request.requestId}` });
  }

  public relayCustomerMessage(
    _operatorTopicId: string,
    message: SupportMessage,
  ): Promise<{ operatorMessageIds: readonly string[] }> {
    return Promise.resolve({
      operatorMessageIds: [
        `web:${message.channel}:${message.externalMessageId}`,
      ],
    });
  }

  public reopenRequest(): Promise<void> {
    return Promise.resolve();
  }
}
