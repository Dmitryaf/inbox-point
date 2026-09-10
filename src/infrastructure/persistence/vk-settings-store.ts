import { z } from 'zod';

import type { VkRuntimeConfig } from '@/config/runtime-config.js';
import {
  readOptionalJsonFile,
  writePrivateJsonFile,
} from '@/infrastructure/file-system/local-state-file.js';

const storedVkSettingsSchema = z
  .object({
    accessToken: z.string().min(20),
    groupId: z.number().int().positive(),
    pollTimeoutSeconds: z.number().int().min(1).max(50),
  })
  .strict();

export interface VkSettingsStore {
  load(): Promise<VkRuntimeConfig | undefined>;
  save(settings: VkRuntimeConfig): Promise<void>;
}

export class FileVkSettingsStore implements VkSettingsStore {
  public constructor(private readonly path: string) {}

  public async load(): Promise<VkRuntimeConfig | undefined> {
    return readOptionalJsonFile(this.path, storedVkSettingsSchema, {
      invalid: 'The local VK settings are invalid',
      read: 'Unable to read the local VK settings',
    });
  }

  public async save(settings: VkRuntimeConfig): Promise<void> {
    await writePrivateJsonFile(this.path, settings);
  }
}
