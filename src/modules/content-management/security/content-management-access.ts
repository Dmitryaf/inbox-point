import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';

export type { PasswordLoginResult as ContentLoginResult } from '@/infrastructure/security/password-session-access.js';

export class ContentManagementAccess extends PasswordSessionAccess {}
