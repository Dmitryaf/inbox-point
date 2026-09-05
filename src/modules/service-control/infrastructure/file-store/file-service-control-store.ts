import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

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

const storedStateSchema = z.object({
  channels: z.object({
    telegram: channelStateSchema,
    vk: channelStateSchema,
  }),
  version: z.literal(1),
});

export class FileServiceControlStore implements ServiceControlStore {
  public constructor(private readonly path: string) {}

  public async load(): Promise<ServiceControlState | undefined> {
    let contents: string;
    try {
      contents = await readFile(this.path, 'utf8');
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return undefined;
      }
      throw new Error('Unable to read the local service control settings');
    }

    let value: unknown;
    try {
      value = JSON.parse(contents);
    } catch {
      throw new Error('The local service control settings are invalid');
    }
    const parsed = storedStateSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error('The local service control settings are invalid');
    }
    const channels = parsed.data.channels;
    return {
      channels: {
        telegram: normalizeChannelState(channels.telegram),
        vk: normalizeChannelState(channels.vk),
      },
    };
  }

  public async save(state: ServiceControlState): Promise<void> {
    const directory = dirname(this.path);
    const temporaryPath = this.path + '.' + process.pid + '.tmp';
    await mkdir(directory, { recursive: true });
    await writeFile(
      temporaryPath,
      JSON.stringify({ ...state, version: 1 }, undefined, 2) + '\n',
      { encoding: 'utf8', mode: 0o600 },
    );
    await rename(temporaryPath, this.path);
    await chmod(this.path, 0o600);
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
