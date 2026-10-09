import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { UsageEvent } from '@/core/model/usage-event.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { initializeSqliteSchema } from '@/infrastructure/persistence/sqlite-schema.js';
import { AnalyticsService } from '@/modules/analytics/application/analytics-service.js';
import { registerAnalyticsRoute } from '@/modules/analytics/presentation/http/analytics-route.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';

const directories: string[] = [];
const repositories: SqliteSupportRepository[] = [];
afterEach(() => {
  repositories.splice(0).forEach((repository) => repository.close());
  directories
    .splice(0)
    .forEach((directory) => rmSync(directory, { recursive: true }));
});
function repository(path = ':memory:') {
  const value = new SqliteSupportRepository(path);
  repositories.push(value);
  return value;
}
const now = new Date('2026-10-04T12:00:00Z');
function event(
  id: string,
  type: UsageEvent['type'],
  channel: UsageEvent['channel'],
  date: string,
  key?: string,
  label?: string,
): UsageEvent {
  return {
    id,
    type,
    channel,
    occurredAt: new Date(date),
    ...(key ? { actionKey: key } : {}),
    ...(label ? { actionLabel: label } : {}),
  };
}
function oldDatabase(path: string): DatabaseSync {
  const database = new DatabaseSync(path);
  initializeSqliteSchema(database);
  database.exec(`DROP TABLE usage_events;
    CREATE TABLE usage_events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL CHECK (event_type IN ('new_request','information_section','first_reply','delivery_failure','web_takeover')), channel TEXT NOT NULL, request_id TEXT, occurred_at TEXT NOT NULL) STRICT;
    CREATE INDEX usage_events_by_time ON usage_events(occurred_at, event_type);
    PRAGMA user_version = 11;`);
  return database;
}

describe('usage analytics', () => {
  it('upgrades v11 preserving every old event and permits idempotent menu actions after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'usage-migration-'));
    directories.push(directory);
    const path = join(directory, 'data.sqlite');
    const database = oldDatabase(path);
    for (const type of [
      'new_request',
      'information_section',
      'first_reply',
      'delivery_failure',
      'web_takeover',
    ]) {
      database
        .prepare('INSERT INTO usage_events VALUES (?, ?, ?, ?, ?)')
        .run(type, type, 'vk', 'request-1', now.toISOString());
    }
    const before = database
      .prepare('SELECT * FROM usage_events ORDER BY id')
      .all();
    database.close();
    const migrated = new SqliteSupportRepository(path);
    const action = event(
      'stable-event',
      'menu_action',
      'telegram',
      now.toISOString(),
      'prices',
      'Цены',
    );
    migrated.recordUsageEvent(action);
    migrated.close();
    const restarted = repository(path);
    restarted.recordUsageEvent(action);
    expect(restarted.getUsageEventCounts(new Date('2026-01-01'))).toEqual({
      new_request: 1,
      information_section: 1,
      menu_action: 1,
      first_reply: 1,
      delivery_failure: 1,
      web_takeover: 1,
    });
    const verification = new DatabaseSync(path, { readOnly: true });
    try {
      expect(
        verification
          .prepare(
            "SELECT id,event_type,channel,request_id,occurred_at FROM usage_events WHERE id != 'stable-event' ORDER BY id",
          )
          .all(),
      ).toEqual(before);
      expect(verification.prepare('PRAGMA user_version').get()).toEqual({
        user_version: 13,
      });
      expect(verification.prepare('PRAGMA integrity_check').get()).toEqual({
        integrity_check: 'ok',
      });
      expect(
        verification
          .prepare(
            'SELECT action_key,action_label FROM usage_events WHERE id = ?',
          )
          .get('information_section'),
      ).toEqual({ action_key: null, action_label: null });
    } finally {
      verification.close();
    }
  });

  it('rolls back a failed migration without replacing the previous table or version', () => {
    const directory = mkdtempSync(join(tmpdir(), 'usage-rollback-'));
    directories.push(directory);
    const path = join(directory, 'data.sqlite');
    const database = oldDatabase(path);
    database.exec(
      "PRAGMA ignore_check_constraints = ON; INSERT INTO usage_events VALUES ('bad', 'unknown', 'vk', NULL, '2026-10-04T12:00:00.000Z');",
    );
    database.close();
    expect(() => new SqliteSupportRepository(path)).toThrow();
    const verification = new DatabaseSync(path);
    try {
      expect(verification.prepare('PRAGMA user_version').get()).toEqual({
        user_version: 11,
      });
      expect(
        verification.prepare('SELECT event_type FROM usage_events').get(),
      ).toEqual({ event_type: 'unknown' });
      expect(
        verification.prepare('PRAGMA table_info(usage_events)').all(),
      ).toHaveLength(5);
    } finally {
      verification.close();
    }
  });

  it('aggregates periods, channels, renamed actions, UTC days and undetailed historical information', () => {
    const store = repository();
    [
      event('old', 'new_request', 'telegram', '2026-09-27T23:59:59Z'),
      event('boundary', 'new_request', 'telegram', '2026-09-28T00:00:00Z'),
      event('request', 'new_request', 'vk', '2026-10-04T00:00:00Z'),
      event(
        'first',
        'menu_action',
        'telegram',
        '2026-10-01T10:00:00Z',
        'custom:stable',
        'Пробное занятие',
      ),
      event(
        'renamed',
        'menu_action',
        'vk',
        '2026-10-04T10:00:00Z',
        'custom:stable',
        'Записаться на пробное',
      ),
      event(
        'question',
        'menu_action',
        'vk',
        '2026-10-04T11:00:00Z',
        'handoff',
        'Задать вопрос',
      ),
      event(
        'legacy',
        'information_section',
        'telegram',
        '2026-10-03T10:00:00Z',
      ),
      event('operational', 'delivery_failure', 'vk', '2026-10-04T11:00:00Z'),
      event('future', 'new_request', 'vk', '2026-10-04T12:00:01Z'),
    ].forEach((value) => store.recordUsageEvent(value));
    const service = new AnalyticsService(store, () => now);
    const report = service.get('7d');
    expect(report.summary).toEqual({ requests: 2, menuActions: 3 });
    expect(report.daily).toHaveLength(7);
    expect(report.daily[0]).toEqual({
      date: '2026-09-28',
      requests: 1,
      menuActions: 0,
    });
    expect(report.daily[1]).toEqual({
      date: '2026-09-29',
      requests: 0,
      menuActions: 0,
    });
    expect(report.daily[6]).toEqual({
      date: '2026-10-04',
      requests: 1,
      menuActions: 2,
    });
    expect(report.lastRequestAt).toBe('2026-10-04T00:00:00.000Z');
    expect(report.actions[0]).toEqual({
      key: 'custom:stable',
      label: 'Записаться на пробное',
      count: 2,
      telegram: 1,
      vk: 1,
    });
    expect(report.actions).toHaveLength(2);
    expect(report.channels.telegram.menuActions).toBe(1);
    expect(report.daily[5]?.menuActions).toBe(0);
    expect(report.daily.reduce((sum, day) => sum + day.menuActions, 0)).toBe(3);
    expect(
      store.getUsageEventCounts(new Date('2026-01-01')).information_section,
    ).toBe(1);
    expect(service.get('7d', 'vk').summary).toEqual({
      requests: 1,
      menuActions: 2,
    });
    expect(service.get('7d', 'vk').channels.telegram).toEqual({
      requests: 0,
      menuActions: 0,
    });
    expect(service.get('30d').summary.requests).toBe(3);
    expect(service.get('90d').daily).toHaveLength(90);
    expect(service.get('7d', 'telegram').actions[0]?.label).toBe(
      'Пробное занятие',
    );
  });

  it('returns zero-filled empty periods and rejects incomplete menu events', () => {
    const store = repository();
    store.recordUsageEvent(
      event(
        'legacy-only',
        'information_section',
        'telegram',
        now.toISOString(),
      ),
    );
    expect(new AnalyticsService(store, () => now).get().daily).toHaveLength(30);
    expect(new AnalyticsService(store, () => now).get().summary).toEqual({
      requests: 0,
      menuActions: 0,
    });
    expect(new AnalyticsService(store, () => now).get().actions).toEqual([]);
    expect(() =>
      store.recordUsageEvent(
        event('bad', 'menu_action', 'vk', now.toISOString()),
      ),
    ).toThrow();
    expect(store.getUsageEventCounts(new Date('2026-01-01')).menu_action).toBe(
      0,
    );
  });

  it('protects the API, validates filters and disables caching', async () => {
    const app = Fastify();
    const password = new PasswordSessionAccess('synthetic-password');
    const access = createAdminRouteAccess(app, password, {
      allowLocalBypass: false,
      secureCookies: false,
    });
    registerAnalyticsRoute(
      app,
      new AnalyticsService(repository(), () => now),
      access,
    );
    try {
      expect((await app.inject('/api/analytics')).statusCode).toBe(401);
      const login = password.login('synthetic-password', 'test-client');
      if (login.kind !== 'authenticated') {
        throw new Error('Expected login');
      }
      const headers = { cookie: `${access.cookieName}=${login.token}` };
      const response = await app.inject({ url: '/api/analytics', headers });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(
        response.json<{ period: string; channel: string }>(),
      ).toMatchObject({ period: '30d', channel: 'all' });
      for (const url of [
        '/api/analytics?period=1d',
        '/api/analytics?channel=other',
        '/api/analytics?period=7d&period=30d',
      ]) {
        expect((await app.inject({ url, headers })).statusCode).toBe(400);
      }
      expect(
        (
          await app.inject({
            url: '/api/analytics?period=90d&channel=vk',
            headers,
          })
        ).statusCode,
      ).toBe(200);
      password.revokeAllSessions();
      expect(
        (await app.inject({ url: '/api/analytics', headers })).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  });
});
