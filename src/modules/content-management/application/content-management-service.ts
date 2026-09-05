import { createHash } from 'node:crypto';

import type {
  ClientInformationContent,
  ClientInformationCatalog,
} from '@/core/application/client-information.js';
import type {
  ContentChange,
  ContentSettingsStore,
} from './ports/content-settings-store.js';

export class ContentManagementService {
  private saveQueue: Promise<void> = Promise.resolve();

  public constructor(
    private readonly catalog: ClientInformationCatalog,
    private readonly store: ContentSettingsStore,
  ) {}

  public get(): ManagedContentSnapshot {
    return createSnapshot(this.catalog.getContent());
  }

  public getHistory(): Promise<readonly ContentChange[]> {
    return this.store.loadHistory();
  }

  public async save(
    content: ClientInformationContent,
    expectedVersion: string,
  ): Promise<ManagedContentSnapshot> {
    const save = this.saveQueue.then(async () => {
      this.assertVersion(expectedVersion);
      await this.store.save(content);
      this.catalog.replace(content);
      return createSnapshot(content);
    });
    this.saveQueue = save.then(
      () => undefined,
      () => undefined,
    );
    return save;
  }

  public async restore(
    revision: number,
    expectedVersion: string,
  ): Promise<ManagedContentSnapshot> {
    const restore = this.saveQueue.then(async () => {
      this.assertVersion(expectedVersion);
      const restored = await this.store.restore(revision);
      this.catalog.replace(restored);
      return createSnapshot(restored);
    });
    this.saveQueue = restore.then(
      () => undefined,
      () => undefined,
    );
    return restore;
  }

  private assertVersion(expectedVersion: string): void {
    const currentVersion = createContentVersion(this.catalog.getContent());
    if (currentVersion !== expectedVersion) {
      throw new ContentVersionConflictError();
    }
  }
}

export interface ManagedContentSnapshot {
  content: ClientInformationContent;
  version: string;
}

export class ContentVersionConflictError extends Error {
  public constructor() {
    super('Content was changed after it was loaded');
    this.name = 'ContentVersionConflictError';
  }
}

function createSnapshot(
  content: ClientInformationContent,
): ManagedContentSnapshot {
  return {
    content,
    version: createContentVersion(content),
  };
}

function createContentVersion(content: ClientInformationContent): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
