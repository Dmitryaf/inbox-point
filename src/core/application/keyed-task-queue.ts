export class KeyedTaskQueue {
  private readonly tails = new Map<string, Promise<void>>();

  public async run<Result>(
    key: string,
    task: () => Promise<Result>,
  ): Promise<Result> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(task);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );

    this.tails.set(key, tail);

    try {
      return await result;
    } finally {
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    }
  }
}
