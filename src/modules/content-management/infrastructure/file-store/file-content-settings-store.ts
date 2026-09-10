import {
  copyClientInformationContent,
  type ClientInformationContent,
} from '@/core/application/client-information.js';
import {
  readOptionalTextFile,
  writePrivateTextFile,
} from '@/infrastructure/file-system/local-state-file.js';
import type {
  ContentChange,
  ContentSettingsDocument,
  ContentSettingsStore,
} from '@/modules/content-management/application/ports/content-settings-store.js';
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
        revision: entry.revision,
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
      (entry) => entry.revision === revision,
    );
    if (!target) {
      throw new Error('The requested content revision is unavailable');
    }
    await this.save(target.content);
    return copyClientInformationContent(target.content);
  }

  private async readDocument(): Promise<ContentSettingsDocument | undefined> {
    try {
      const contents = await readOptionalTextFile(this.path);
      return contents === undefined
        ? undefined
        : parseContentDocument(contents);
    } catch (error: unknown) {
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
    await writePrivateTextFile(this.path, serializeContentDocument(document));
  }
}

function nextRevision(document: ContentSettingsDocument | undefined): number {
  return (
    Math.max(0, ...(document?.history.map((entry) => entry.revision) ?? [])) + 1
  );
}
