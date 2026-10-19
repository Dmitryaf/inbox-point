import type {
  OperationsStatus,
  OperatorActionResolution,
} from '@frontend-common/entities/operations/model/types';
export interface OverviewProps {
  status: OperationsStatus;
  statusUnavailable: boolean;
  pendingDeliveryId: string;
  pendingOperatorActionId: string;
  pendingInboundEventId: string;
  onRetryDelivery: (id: string) => void;
  onResolveDelivery: (
    id: string,
    resolution: 'not_received' | 'received',
  ) => void;
  onResolveOperatorAction: (
    id: string,
    resolution: OperatorActionResolution,
  ) => void;
  onResolveInboundEvent: (
    id: string,
    source: string,
    resolution: 'retry' | 'skip',
  ) => void;
}
