export interface RememberedAdminSession {
  createdAt: number;
  expiresAt: number;
  tokenHash: string;
}

export interface RememberedAdminSessionStore {
  delete(tokenHash: string): void;
  deleteAll(): void;
  hasActive(tokenHash: string, now: number): boolean;
  save(session: RememberedAdminSession): void;
}
