import { describe, expect, it } from 'vitest';

import { ContentManagementAccess } from '@/modules/content-management/security/content-management-access.js';

describe('ContentManagementAccess', () => {
  it('creates an expiring session for the configured password', () => {
    let now = 1_000;
    const access = new ContentManagementAccess('correct-password', {
      createToken: () => 'session-token',
      now: () => now,
      sessionTtlMs: 1_000,
    });

    expect(access.login('correct-password', 'client-1')).toEqual({
      kind: 'authenticated',
      token: 'session-token',
    });
    expect(access.authenticate('session-token')).toBe(true);

    now = 2_001;
    expect(access.authenticate('session-token')).toBe(false);
  });

  it('blocks repeated password attempts without exposing the password', () => {
    const access = new ContentManagementAccess('correct-password', {
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
    const access = new ContentManagementAccess('correct-password', {
      createToken: () => 'session-token',
    });
    access.login('correct-password', 'client-1');

    access.logout('session-token');

    expect(access.authenticate('session-token')).toBe(false);
  });
});
