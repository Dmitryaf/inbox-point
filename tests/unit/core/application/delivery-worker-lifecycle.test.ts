import { afterEach, describe, expect, it } from 'vitest';

import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

describe('DeliveryWorker lifecycle', () => {
  const repositories: SqliteSupportRepository[] = [];

  afterEach(() => {
    for (const repository of repositories.splice(0)) {
      repository.close();
    }
  });

  it('reports start, cycle and stop states from the run loop', async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const repository = new SqliteSupportRepository(':memory:');
    repositories.push(repository);
    const worker = new DeliveryWorker({
      activity: {
        recordWorkerCycle: () => {
          events.push('cycle');
          controller.abort();
        },
        recordWorkerStarted: () => events.push('started'),
        recordWorkerStopped: () => events.push('stopped'),
      },
      channels: [],
      repository,
    });

    await worker.run(controller.signal);

    expect(events).toEqual(['started', 'cycle', 'stopped']);
  });
});
