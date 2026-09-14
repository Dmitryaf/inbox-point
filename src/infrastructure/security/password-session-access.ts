import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import type {
  RememberedAdminSession,
  RememberedAdminSessionStore,
} from '@/infrastructure/security/remembered-session-store.js';

const defaultSessionTtlMs = 12 * 60 * 60 * 1_000;
const defaultRememberedSessionTtlMs = 30 * 24 * 60 * 60 * 1_000;
const attemptWindowMs = 15 * 60 * 1_000;
const maximumAttempts = 5;
const sessionTokenPattern = /^[A-Za-z0-9_-]{12,128}$/;

export type PasswordLoginResult =
  | {
      kind: 'authenticated';
      maxAgeSeconds: number;
      remembered: boolean;
      token: string;
    }
  | { kind: 'blocked'; retryAfterSeconds: number }
  | { kind: 'invalid' };

interface FailedAttemptState {
  attempts: number;
  blockedUntil?: number;
  startedAt: number;
}

export interface PasswordSessionAccessOptions {
  createToken?: () => string;
  now?: () => number;
  rememberedSessionStore?: RememberedAdminSessionStore;
  rememberedSessionTtlMs?: number;
  sessionTtlMs?: number;
}

export class PasswordSessionAccess {
  private readonly createToken: () => string;
  private readonly failedAttempts = new Map<string, FailedAttemptState>();
  private readonly now: () => number;
  private readonly rememberedSessionStore: RememberedAdminSessionStore;
  private readonly rememberedSessionTtlMs: number;
  private readonly sessionTtlMs: number;
  private readonly sessions = new Map<string, number>();

  public constructor(
    private readonly password: string | undefined,
    options: PasswordSessionAccessOptions = {},
  ) {
    this.createToken =
      options.createToken ?? (() => randomBytes(32).toString('base64url'));
    this.now = options.now ?? Date.now;
    this.rememberedSessionStore =
      options.rememberedSessionStore ?? new MemoryRememberedSessionStore();
    this.rememberedSessionTtlMs =
      options.rememberedSessionTtlMs ?? defaultRememberedSessionTtlMs;
    this.sessionTtlMs = options.sessionTtlMs ?? defaultSessionTtlMs;
  }

  public isConfigured(): boolean {
    return this.password !== undefined;
  }

  public login(
    password: string,
    clientId: string,
    rememberDevice = false,
    currentToken?: string,
  ): PasswordLoginResult {
    if (!this.password) {
      return { kind: 'invalid' };
    }

    const now = this.now();
    const failed = this.failedAttempts.get(clientId);
    if (failed?.blockedUntil && failed.blockedUntil > now) {
      return {
        kind: 'blocked',
        retryAfterSeconds: Math.ceil((failed.blockedUntil - now) / 1_000),
      };
    }

    if (!matchesSecret(password, this.password)) {
      return this.recordFailedAttempt(clientId, now);
    }

    this.failedAttempts.delete(clientId);
    this.logout(currentToken);
    this.deleteExpiredSessions(now);
    const token = this.createToken();
    const tokenHash = hashSessionToken(token, this.password);
    const ttlMs = rememberDevice
      ? this.rememberedSessionTtlMs
      : this.sessionTtlMs;
    const expiresAt = now + ttlMs;
    if (rememberDevice) {
      this.rememberedSessionStore.save({
        createdAt: now,
        expiresAt,
        tokenHash,
      });
    } else {
      this.sessions.set(tokenHash, expiresAt);
    }
    return {
      kind: 'authenticated',
      maxAgeSeconds: Math.ceil(ttlMs / 1_000),
      remembered: rememberDevice,
      token,
    };
  }

  public authenticate(token: string | undefined): boolean {
    if (!this.password || !token || !sessionTokenPattern.test(token)) {
      return false;
    }
    const now = this.now();
    const tokenHash = hashSessionToken(token, this.password);
    const expiresAt = this.sessions.get(tokenHash);
    if (expiresAt && expiresAt > now) {
      return true;
    }
    this.sessions.delete(tokenHash);
    return this.rememberedSessionStore.hasActive(tokenHash, now);
  }

  public logout(token: string | undefined): void {
    if (!this.password || !token || !sessionTokenPattern.test(token)) {
      return;
    }
    const tokenHash = hashSessionToken(token, this.password);
    this.sessions.delete(tokenHash);
    this.rememberedSessionStore.delete(tokenHash);
  }

  public revokeAllSessions(): void {
    this.sessions.clear();
    this.rememberedSessionStore.deleteAll();
  }

  private recordFailedAttempt(
    clientId: string,
    now: number,
  ): PasswordLoginResult {
    const previous = this.failedAttempts.get(clientId);
    const state =
      !previous || now - previous.startedAt >= attemptWindowMs
        ? { attempts: 1, startedAt: now }
        : {
            attempts: previous.attempts + 1,
            startedAt: previous.startedAt,
          };

    if (state.attempts >= maximumAttempts) {
      const blockedUntil = now + attemptWindowMs;
      this.failedAttempts.set(clientId, { ...state, blockedUntil });
      return {
        kind: 'blocked',
        retryAfterSeconds: Math.ceil((blockedUntil - now) / 1_000),
      };
    }

    this.failedAttempts.set(clientId, state);
    return { kind: 'invalid' };
  }

  private deleteExpiredSessions(now: number): void {
    for (const [token, expiresAt] of this.sessions) {
      if (expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }
}

class MemoryRememberedSessionStore implements RememberedAdminSessionStore {
  private readonly sessions = new Map<string, RememberedAdminSession>();

  public delete(tokenHash: string): void {
    this.sessions.delete(tokenHash);
  }

  public deleteAll(): void {
    this.sessions.clear();
  }

  public hasActive(tokenHash: string, now: number): boolean {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= now) {
      this.sessions.delete(tokenHash);
      return false;
    }
    return true;
  }

  public save(session: RememberedAdminSession): void {
    this.sessions.set(session.tokenHash, session);
  }
}

function hashSessionToken(token: string, password: string): string {
  return createHmac('sha256', password).update(token).digest('hex');
}

function matchesSecret(received: string, expected: string): boolean {
  const receivedDigest = createHash('sha256').update(received).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}
