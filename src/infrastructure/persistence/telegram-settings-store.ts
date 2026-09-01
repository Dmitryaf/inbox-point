import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

import type { TelegramRuntimeConfig } from '@/config/runtime-config.js';

const storedTelegramSettingsSchema = z.object({
  botToken: z.string().min(20),
  operatorChatId: z.number().int().safe().negative(),
  pollTimeoutSeconds: z.number().int().min(1).max(50),
  version: z.literal(1),
});

export interface TelegramSettingsStore {
  load(): Promise<TelegramRuntimeConfig | undefined>;
  save(settings: TelegramRuntimeConfig): Promise<void>;
}

export class FileTelegramSettingsStore implements TelegramSettingsStore {
  public constructor(private readonly path: string) {}

  public async load(): Promise<TelegramRuntimeConfig | undefined> {
    let contents: string;
    try {
      contents = await readFile(this.path, 'utf8');
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return undefined;
      }
      throw new Error('Unable to read the local Telegram settings');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      throw new Error('The local Telegram settings are invalid');
    }

    const result = storedTelegramSettingsSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error('The local Telegram settings are invalid');
    }

    return {
      botToken: result.data.botToken,
      operatorChatId: result.data.operatorChatId,
      pollTimeoutSeconds: result.data.pollTimeoutSeconds,
    };
  }

  public async save(settings: TelegramRuntimeConfig): Promise<void> {
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
