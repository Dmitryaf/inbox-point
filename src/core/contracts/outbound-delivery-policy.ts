export interface OutboundDeliveryPolicy {
  isDeliveryPaused(): boolean;
}

export const activeOutboundDeliveryPolicy: OutboundDeliveryPolicy = {
  isDeliveryPaused: () => false,
};
