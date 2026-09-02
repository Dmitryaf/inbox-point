import type {
  ClientInformationContent,
  ClientInformationCatalog,
} from '@/core/application/client-information.js';
import type {
  ContentChange,
  ContentSettingsStore,
} from '@/infrastructure/persistence/content-settings-store.js';

export class ContentSetupController {
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
}
