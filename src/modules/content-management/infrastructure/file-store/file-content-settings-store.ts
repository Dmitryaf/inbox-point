import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ClientInformationContent } from '@/core/application/client-information.js';
import type {
  ContentChange,
  ContentSettingsDocument,
  ContentSettingsStore,
} from '@/modules/content-management/application/ports/content-settings-store.js';
import { copyContent } from './content-mapper.js';
import {
  findChangedSections,
  parseContentDocument,
  serializeContentDocument,
  validateContentInput,
} from './document-codec.js';

export class FileContentSettingsStore implements ContentSettingsStore {
  public constructor(
    private readonly path: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async load(): Promise<ClientInformationContent | undefined> {
    return (await this.readDocument())?.content;
  }

  public async loadHistory(): Promise<readonly ContentChange[]> {
    const document = await this.readDocument();
    return (
      document?.history.map((entry) => ({
        changedAt: entry.changedAt,
        ...(entry.revision ? { revision: entry.revision } : {}),
        sections: [...entry.sections],
      })) ?? []
    );
  }

  public async save(content: ClientInformationContent): Promise<void> {
    const validated = validateContentInput(content);
    const current = await this.readDocument();
    const sections = findChangedSections(current?.content ?? {}, validated);
    if (sections.length === 0) {
      return;
    }

    const revision = nextRevision(current);
    await this.writeDocument({
      content: validated,
      history: [
        {
          changedAt: this.now().toISOString(),
          content: validated,
          revision,
          sections,
        },
        ...(current?.history ?? []),
      ].slice(0, 20),
    });
  }

  public async restore(revision: number): Promise<ClientInformationContent> {
    const current = await this.readDocument();
    const target = current?.history.find(
      (entry) => entry.revision === revision && entry.content,
    );
    if (!target?.content) {
      throw new Error('The requested content revision is unavailable');
    }
    await this.save(target.content);
    return copyContent(target.content);
  }

  private async readDocument(): Promise<ContentSettingsDocument | undefined> {
    try {
      return parseContentDocument(await readFile(this.path, 'utf8'));
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return undefined;
      }
      if (
        error instanceof Error &&
        error.message === 'The local content settings are invalid'
      ) {
        throw error;
      }
      throw new Error('Unable to read the local content settings', {
        cause: error,
      });
    }
  }

  private async writeDocument(
    document: ContentSettingsDocument,
  ): Promise<void> {
    const directory = dirname(this.path);
    const temporaryPath = this.path + '.' + process.pid + '.tmp';
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, serializeContentDocument(document), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporaryPath, this.path);
    await chmod(this.path, 0o600);
  }
}

function nextRevision(document: ContentSettingsDocument | undefined): number {
  return (
    Math.max(
      0,
      ...(document?.history.map((entry) => entry.revision ?? 0) ?? []),
    ) + 1
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
