export interface VkLongPollReadinessGateway {
  getLongPollServer(groupId: number): Promise<unknown>;
  getLongPollSettings(groupId: number): Promise<{
    enabled: boolean;
    messageNew: boolean;
    messageReply: boolean;
  }>;
}

export async function assertVkLongPollReady(
  gateway: VkLongPollReadinessGateway,
  groupId: number,
): Promise<void> {
  const longPoll = await gateway.getLongPollSettings(groupId);
  if (!longPoll.enabled) {
    throw new Error('VK Long Poll is disabled');
  }
  if (!longPoll.messageNew) {
    throw new Error('VK Long Poll message_new event is disabled');
  }
  if (!longPoll.messageReply) {
    throw new Error('VK Long Poll message_reply event is disabled');
  }
  await gateway.getLongPollServer(groupId);
}
