import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { createApp } from '@/infrastructure/http/app.js';
import { registerFrontendRoutes } from '@/infrastructure/http/frontend-asset-routes.js';
import { loadFrontendAssets } from '@/infrastructure/http/frontend-assets.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import { FileContentSettingsStore } from '@/modules/content-management/infrastructure/file-store/file-content-settings-store.js';
import { registerManagementContentRoutes } from '@/modules/content-management/presentation/http/content-routes.js';

// Each run owns a new temporary file store. No dotenv or channel adapters.
const root = await mkdtemp(join(tmpdir(), 'inbox-point-react-editor-'));
const port = Number(
  process.argv.find((value) => value.startsWith('--port='))?.slice(7) ?? 4190,
);
const app = createApp({
  closedRequestRetentionDays: 7,
  databasePath: join(root, 'unused.sqlite'),
  host: '127.0.0.1',
  instanceId: 'react-editor-test',
  logLevel: 'silent',
  nodeEnv: 'test',
  port,
});
const passwordAccess = new PasswordSessionAccess('synthetic-admin-password');
const access = createAdminRouteAccess(app, passwordAccess, {
  allowLocalBypass: false,
  secureCookies: false,
});
registerAdminSessionRoutes(app, passwordAccess, access, false);
const catalog = new ClientInformationCatalog();
const store = new FileContentSettingsStore(join(root, 'content-settings.json'));
const content = new ContentManagementService(catalog, store);
await content.save(
  {
    ...catalog.getContent(),
    organizationName: 'Учебная организация',
    prices: 'Пробное занятие — бесплатно.',
    address: 'ул. Примерная, 10',
    faq: [{ question: 'Как записаться?', answer: 'Напишите нам.' }],
    customSections: [
      {
        id: 'school',
        label: 'О школе',
        text: 'Сохранённая информация',
        mode: 'information',
      },
    ],
    directions: [{ id: 'dance', name: 'Танец' }],
    groups: [
      {
        id: 'group',
        directionId: 'dance',
        name: 'Начинающие',
        meetings: ['Понедельник, 19:00'],
        description: '',
        enrollmentOpen: false,
        applicationQuestion: '',
      },
      {
        id: 'review',
        directionId: '',
        name: '',
        meetings: [],
        description: '',
        enrollmentOpen: false,
        applicationQuestion: '',
        review: { source: 'Необычная запись\nСреда, 21:00\nС нуля' },
      },
    ],
    keywords: [{ phrase: 'танцы', targetType: 'group', targetId: 'group' }],
  },
  content.get().version,
);
registerManagementContentRoutes(app, content, access);
registerFrontendRoutes(app, access, loadFrontendAssets('dist/frontend-react'));
await app.listen({ host: '127.0.0.1', port });
