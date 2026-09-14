import { describe, expect, it } from 'vitest';

import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import type {
  RememberedAdminSession,
  RememberedAdminSessionStore,
} from '@/infrastructure/security/remembered-session-store.js';

class TestRememberedSessionStore implements RememberedAdminSessionStore {
  public readonly sessions = new Map<string, RememberedAdminSession>();

  public delete(tokenHash: string): void {
    this.sessions.delete(tokenHash);
  }

  public deleteAll(): void {
    this.sessions.clear();
  }

  public hasActive(tokenHash: string, now: number): boolean {
    const session = this.sessions.get(tokenHash);
    return Boolean(session && session.expiresAt > now);
  }

  public save(session: RememberedAdminSession): void {
    this.sessions.set(session.tokenHash, session);
  }
}

describe('PasswordSessionAccess', () => {
  it('creates an expiring session for the configured password', () => {
    let now = 1_000;
    const access = new PasswordSessionAccess('correct-password', {
      createToken: () => 'session-token',
      now: () => now,
      sessionTtlMs: 1_000,
    });

    expect(access.login('correct-password', 'client-1')).toEqual({
      kind: 'authenticated',
      maxAgeSeconds: 1,
      remembered: false,
      token: 'session-token',
    });
    expect(access.authenticate('session-token')).toBe(true);

    now = 2_001;
    expect(access.authenticate('session-token')).toBe(false);
  });

  it('blocks repeated password attempts without exposing the password', () => {
    const access = new PasswordSessionAccess('correct-password', {
      now: () => 1_000,
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(access.login('wrong-password', 'client-1')).toEqual({
        kind: 'invalid',
      });
    }

    expect(access.login('wrong-password', 'client-1')).toEqual({
      kind: 'blocked',
      retryAfterSeconds: 900,
    });
    expect(access.login('correct-password', 'client-1')).toEqual({
      kind: 'blocked',
      retryAfterSeconds: 900,
    });
  });

  it('invalidates a session on logout', () => {
    const access = new PasswordSessionAccess('correct-password', {
      createToken: () => 'session-token',
    });
    access.login('correct-password', 'client-1');

    access.logout('session-token');

    expect(access.authenticate('session-token')).toBe(false);
  });

  it('keeps remembered sessions across access instances without storing raw tokens', () => {
    const store = new TestRememberedSessionStore();
    const firstAccess = new PasswordSessionAccess('correct-password', {
      createToken: () => 'remembered-session-token',
      now: () => 1_000,
      rememberedSessionStore: store,
      rememberedSessionTtlMs: 5_000,
    });

    expect(firstAccess.login('correct-password', 'client-1', true)).toEqual({
      kind: 'authenticated',
      maxAgeSeconds: 5,
      remembered: true,
      token: 'remembered-session-token',
    });
    expect([...store.sessions.keys()]).not.toContain(
      'remembered-session-token',
    );

    const restartedAccess = new PasswordSessionAccess('correct-password', {
      now: () => 2_000,
      rememberedSessionStore: store,
    });
    expect(restartedAccess.authenticate('remembered-session-token')).toBe(true);
  });

  it('rejects expired, malformed, unknown, and old-password remembered tokens', () => {
    let now = 1_000;
    const store = new TestRememberedSessionStore();
    const access = new PasswordSessionAccess('correct-password', {
      createToken: () => 'remembered-session-token',
      now: () => now,
      rememberedSessionStore: store,
      rememberedSessionTtlMs: 1_000,
    });
    access.login('correct-password', 'client-1', true);

    expect(access.authenticate('malformed token')).toBe(false);
    expect(access.authenticate('unknown-token-value')).toBe(false);
    expect(
      new PasswordSessionAccess('changed-password', {
        now: () => now,
        rememberedSessionStore: store,
      }).authenticate('remembered-session-token'),
    ).toBe(false);

    now = 2_001;
    expect(access.authenticate('remembered-session-token')).toBe(false);
  });

  it('revokes ordinary and remembered sessions together', () => {
    const store = new TestRememberedSessionStore();
    const tokens = ['ordinary-session-token', 'remembered-session-token'];
    const access = new PasswordSessionAccess('correct-password', {
      createToken: () => tokens.shift()!,
      rememberedSessionStore: store,
    });
    access.login('correct-password', 'client-1');
    access.login('correct-password', 'client-2', true);

    access.revokeAllSessions();

    expect(access.authenticate('ordinary-session-token')).toBe(false);
    expect(access.authenticate('remembered-session-token')).toBe(false);
  });

  it('rotates the presented session only after a successful login', () => {
    const tokens = ['first-session-token', 'second-session-token'];
    const access = new PasswordSessionAccess('correct-password', {
      createToken: () => tokens.shift()!,
    });
    access.login('correct-password', 'client-1');

    access.login('wrong-password', 'client-1', false, 'first-session-token');
    expect(access.authenticate('first-session-token')).toBe(true);

    access.login('correct-password', 'client-1', false, 'first-session-token');

    expect(access.authenticate('first-session-token')).toBe(false);
    expect(access.authenticate('second-session-token')).toBe(true);
  });
});
