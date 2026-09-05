import type { ServiceControlState } from '@/modules/service-control/model/service-control-state.js';

export interface ServiceControlStore {
  load(): Promise<ServiceControlState | undefined>;
  save(state: ServiceControlState): Promise<void>;
}
