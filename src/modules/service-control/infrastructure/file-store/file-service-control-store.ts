import { z } from 'zod';

import {
  readOptionalJsonFile,
  writePrivateJsonFile,
} from '@/infrastructure/file-system/local-state-file.js';
import type { ServiceControlStore } from '@/modules/service-control/application/ports/service-control-store.js';
import type {
  ChannelIntakeState,
  ServiceControlState,
} from '@/modules/service-control/model/service-control-state.js';

const channelStateSchema = z.object({
  changedAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)))
    .optional(),
  mode: z.enum(['active', 'paused']),
});

const storedStateSchema = z
  .object({
    channels: z.object({
      telegram: channelStateSchema,
      vk: channelStateSchema,
    }),
    delivery: channelStateSchema,
  })
  .strict();

export class FileServiceControlStore implements ServiceControlStore {
  public constructor(private readonly path: string) {}

  public async load(): Promise<ServiceControlState | undefined> {
    const stored = await readOptionalJsonFile(this.path, storedStateSchema, {
      invalid: 'The local service control settings are invalid',
      read: 'Unable to read the local service control settings',
    });
    if (!stored) {
      return undefined;
    }
    const channels = stored.channels;
    return {
      channels: {
        telegram: normalizeChannelState(channels.telegram),
        vk: normalizeChannelState(channels.vk),
      },
      delivery: normalizeChannelState(stored.delivery),
    };
  }

  public async save(state: ServiceControlState): Promise<void> {
    await writePrivateJsonFile(this.path, state);
  }
}

function normalizeChannelState(state: {
  changedAt?: string | undefined;
  mode: ChannelIntakeState['mode'];
}): ChannelIntakeState {
  return {
    ...(state.changedAt ? { changedAt: state.changedAt } : {}),
    mode: state.mode,
  };
}
