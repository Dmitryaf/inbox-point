import { describe, expect, it } from 'vitest';

import { KeyedTaskQueue } from '@/core/application/keyed-task-queue.js';

describe('KeyedTaskQueue', () => {
  it('runs tasks for the same key in order', async () => {
    const queue = new KeyedTaskQueue();
    const firstGate = Promise.withResolvers<void>();
    const firstStarted = Promise.withResolvers<void>();
    const order: string[] = [];

    const first = queue.run('telegram:101', async () => {
      order.push('first-started');
      firstStarted.resolve();
      await firstGate.promise;
      order.push('first-finished');
    });
    const second = queue.run('telegram:101', () => {
      order.push('second-started');
      return Promise.resolve();
    });

    await firstStarted.promise;

    expect(order).toEqual(['first-started']);

    firstGate.resolve();
    await Promise.all([first, second]);

    expect(order).toEqual([
      'first-started',
      'first-finished',
      'second-started',
    ]);
  });

  it('does not block a task with another key', async () => {
    const queue = new KeyedTaskQueue();
    const firstGate = Promise.withResolvers<void>();
    let otherTaskFinished = false;

    const blocked = queue.run('telegram:101', async () => {
      await firstGate.promise;
    });

    await queue.run('telegram:202', () => {
      otherTaskFinished = true;
      return Promise.resolve();
    });

    expect(otherTaskFinished).toBe(true);

    firstGate.resolve();
    await blocked;
  });

  it('continues queued work after a failed task', async () => {
    const queue = new KeyedTaskQueue();
    const firstGate = Promise.withResolvers<void>();

    const failed = queue.run('telegram:101', async () => {
      await firstGate.promise;
      throw new Error('Opening the topic failed');
    });
    const next = queue.run('telegram:101', () => {
      return Promise.resolve('completed');
    });

    firstGate.resolve();

    await expect(failed).rejects.toThrow('Opening the topic failed');
    await expect(next).resolves.toBe('completed');
  });
});
