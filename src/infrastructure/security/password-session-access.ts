import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const defaultSessionTtlMs = 12 * 60 * 60 * 1_000;
const attemptWindowMs = 15 * 60 * 1_000;
const maximumAttempts = 5;

export type PasswordLoginResult =
  | { kind: 'authenticated'; token: string }
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
  sessionTtlMs?: number;
}

export class PasswordSessionAccess {
  private readonly createToken: () => string;
  private readonly failedAttempts = new Map<string, FailedAttemptState>();
  private readonly now: () => number;
  private readonly sessionTtlMs: number;
  private readonly sessions = new Map<string, number>();

  public constructor(
    private readonly password: string | undefined,
    options: PasswordSessionAccessOptions = {},
  ) {
    this.createToken =
      options.createToken ?? (() => randomBytes(32).toString('base64url'));
    this.now = options.now ?? Date.now;
    this.sessionTtlMs = options.sessionTtlMs ?? defaultSessionTtlMs;
  }

  public isConfigured(): boolean {
    return this.password !== undefined;
  }

  public login(password: string, clientId: string): PasswordLoginResult {
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
    this.deleteExpiredSessions(now);
    const token = this.createToken();
    this.sessions.set(token, now + this.sessionTtlMs);
    return { kind: 'authenticated', token };
  }

  public authenticate(token: string | undefined): boolean {
    if (!token) {
      return false;
    }
    const now = this.now();
    const expiresAt = this.sessions.get(token);
    if (!expiresAt || expiresAt <= now) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  public logout(token: string | undefined): void {
    if (token) {
      this.sessions.delete(token);
    }
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

function matchesSecret(received: string, expected: string): boolean {
  const receivedDigest = createHash('sha256').update(received).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}
