import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

import {
  type ClientInformationContent,
  hasValidCustomSections,
} from '@/core/application/client-information.js';

const storedContentSchema = z.object({
  address: z.string().min(1).max(4_000).optional(),
  customSections: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        text: z.string().min(1).max(4_000),
      }),
    )
    .max(6)
    .optional(),
  prices: z.string().min(1).max(4_000).optional(),
  schedule: z.string().min(1).max(4_000).optional(),
  version: z.literal(1),
});

export interface ContentSettingsStore {
  load(): Promise<ClientInformationContent | undefined>;
  save(content: ClientInformationContent): Promise<void>;
}

export class FileContentSettingsStore implements ContentSettingsStore {
  public constructor(private readonly path: string) {}

  public async load(): Promise<ClientInformationContent | undefined> {
    let contents: string;
    try {
      contents = await readFile(this.path, 'utf8');
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') return undefined;
      throw new Error('Unable to read the local content settings');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      throw new Error('The local content settings are invalid');
    }
    const result = storedContentSchema.safeParse(parsed);
    if (
      !result.success ||
      !hasValidCustomSections(result.data.customSections ?? [])
    ) {
      throw new Error('The local content settings are invalid');
    }
    return pickContent(result.data);
  }

  public async save(content: ClientInformationContent): Promise<void> {
    const validated = storedContentSchema.parse({ version: 1, ...content });
    if (!hasValidCustomSections(validated.customSections ?? [])) {
      throw new Error('The local content settings are invalid');
    }
    const directory = dirname(this.path);
    const temporaryPath = this.path + '.' + process.pid + '.tmp';
    await mkdir(directory, { recursive: true });
    await writeFile(
      temporaryPath,
      JSON.stringify(validated, undefined, 2) + '\n',
      { encoding: 'utf8', mode: 0o600 },
    );
    await rename(temporaryPath, this.path);
    await chmod(this.path, 0o600);
  }
}

function pickContent(value: z.infer<typeof storedContentSchema>) {
  return {
    ...(value.address ? { address: value.address } : {}),
    ...(value.customSections
      ? {
          customSections: value.customSections.map((section) => ({
            ...section,
          })),
        }
      : {}),
    ...(value.prices ? { prices: value.prices } : {}),
    ...(value.schedule ? { schedule: value.schedule } : {}),
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
