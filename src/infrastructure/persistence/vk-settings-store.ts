import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

import type { VkRuntimeConfig } from '@/config/runtime-config.js';

const storedVkSettingsSchema = z.object({
  accessToken: z.string().min(20),
  groupId: z.number().int().positive(),
  pollTimeoutSeconds: z.number().int().min(1).max(50),
  version: z.literal(1),
});

export interface VkSettingsStore {
  load(): Promise<VkRuntimeConfig | undefined>;
  save(settings: VkRuntimeConfig): Promise<void>;
}

export class FileVkSettingsStore implements VkSettingsStore {
  public constructor(private readonly path: string) {}

  public async load(): Promise<VkRuntimeConfig | undefined> {
    let contents: string;
    try {
      contents = await readFile(this.path, 'utf8');
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return undefined;
      }
      throw new Error('Unable to read the local VK settings');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      throw new Error('The local VK settings are invalid');
    }
    const result = storedVkSettingsSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error('The local VK settings are invalid');
    }
    return {
      accessToken: result.data.accessToken,
      groupId: result.data.groupId,
      pollTimeoutSeconds: result.data.pollTimeoutSeconds,
    };
  }

  public async save(settings: VkRuntimeConfig): Promise<void> {
    const directory = dirname(this.path);
    const temporaryPath = this.path + '.' + process.pid + '.tmp';
    await mkdir(directory, { recursive: true });
    await writeFile(
      temporaryPath,
      JSON.stringify({ version: 1, ...settings }, undefined, 2) + '\n',
      { encoding: 'utf8', mode: 0o600 },
    );
    await rename(temporaryPath, this.path);
    await chmod(this.path, 0o600);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
