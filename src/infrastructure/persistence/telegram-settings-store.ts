import { z } from 'zod';

import type { TelegramRuntimeConfig } from '@/config/runtime-config.js';
import {
  readOptionalJsonFile,
  writePrivateJsonFile,
} from '@/infrastructure/file-system/local-state-file.js';

const storedTelegramSettingsSchema = z
  .object({
    botToken: z.string().min(20),
    operatorChatId: z.number().int().safe().negative(),
    pollTimeoutSeconds: z.number().int().min(1).max(50),
  })
  .strict();

export interface TelegramSettingsStore {
  load(): Promise<TelegramRuntimeConfig | undefined>;
  save(settings: TelegramRuntimeConfig): Promise<void>;
}

export class FileTelegramSettingsStore implements TelegramSettingsStore {
  public constructor(private readonly path: string) {}

  public async load(): Promise<TelegramRuntimeConfig | undefined> {
    return readOptionalJsonFile(this.path, storedTelegramSettingsSchema, {
      invalid: 'The local Telegram settings are invalid',
      read: 'Unable to read the local Telegram settings',
    });
  }

  public async save(settings: TelegramRuntimeConfig): Promise<void> {
    await writePrivateJsonFile(this.path, settings);
  }
}
