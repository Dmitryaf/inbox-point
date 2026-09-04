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

  public get(): ClientInformationContent {
    return this.catalog.getContent();
  }

  public getHistory(): Promise<readonly ContentChange[]> {
    return this.store.loadHistory();
  }

  public async save(content: ClientInformationContent): Promise<void> {
    const save = this.saveQueue.then(async () => {
      await this.store.save(content);
      this.catalog.replace(content);
    });
    this.saveQueue = save.catch(() => undefined);
    await save;
  }

  public async restore(revision: number): Promise<void> {
    const restore = this.saveQueue.then(async () => {
      const restored = await this.store.restore(revision);
      this.catalog.replace(restored);
    });
    this.saveQueue = restore.catch(() => undefined);
    await restore;
  }
}
