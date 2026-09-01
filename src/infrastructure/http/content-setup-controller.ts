import type {
  ClientInformationContent,
  ClientInformationCatalog,
} from '@/core/application/client-information.js';
import type { ContentSettingsStore } from '@/infrastructure/persistence/content-settings-store.js';

export class ContentSetupController {
  public constructor(
    private readonly catalog: ClientInformationCatalog,
    private readonly store: ContentSettingsStore,
  ) {}

  public get(): ClientInformationContent {
    return this.catalog.getContent();
  }

  public async save(content: ClientInformationContent): Promise<void> {
    await this.store.save(content);
    this.catalog.replace(content);
  }
}
