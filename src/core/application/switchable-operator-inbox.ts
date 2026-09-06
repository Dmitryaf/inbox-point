import {
  OperatorInboxUnavailableError,
  type OpenOperatorRequest,
  type OperatorInbox,
  type RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import type { SupportMessage } from '@/core/model/support-message.js';

export class SwitchableOperatorInbox implements OperatorInbox {
  private inbox: OperatorInbox | undefined;

  public closeRequest(operatorTopicId: string): Promise<void> {
    return this.requireInbox().closeRequest(operatorTopicId);
  }

  public openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    return this.requireInbox().openRequest(request);
  }

  public register(inbox: OperatorInbox): () => void {
    this.inbox = inbox;
    return () => {
      if (this.inbox === inbox) {
        this.inbox = undefined;
      }
    };
  }

  public relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ): Promise<{ operatorMessageIds: readonly string[] }> {
    return this.requireInbox().relayCustomerMessage(
      operatorTopicId,
      message,
      options,
    );
  }

  public reopenRequest(operatorTopicId: string): Promise<void> {
    return this.requireInbox().reopenRequest(operatorTopicId);
  }

  private requireInbox(): OperatorInbox {
    if (!this.inbox) {
      throw new OperatorInboxUnavailableError();
    }
    return this.inbox;
  }
}
