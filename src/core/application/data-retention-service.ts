import type {
  RetentionCleanupResult,
  SupportRepository,
} from '@/core/contracts/support-repository.js';

const millisecondsPerDay = 24 * 60 * 60 * 1_000;
const defaultCleanupIntervalMilliseconds = 6 * 60 * 60 * 1_000;

export interface DataRetentionLogger {
  error(error: unknown, message: string): void;
  info(details: object, message: string): void;
  warn(details: object, message: string): void;
}

export interface DataRetentionServiceOptions {
  cleanupIntervalMilliseconds?: number;
  now?: () => Date;
}

export class DataRetentionService {
  private interval: NodeJS.Timeout | undefined;
  private readonly cleanupIntervalMilliseconds: number;
  private readonly now: () => Date;

  public constructor(
    private readonly repository: Pick<
      SupportRepository,
      'purgeClosedConversationContent'
    >,
    private readonly retentionDays: number,
    private readonly logger: DataRetentionLogger,
    options: DataRetentionServiceOptions = {},
  ) {
    if (!Number.isInteger(retentionDays) || retentionDays < 1) {
      throw new Error('Retention days must be a positive integer');
    }

    this.cleanupIntervalMilliseconds =
      options.cleanupIntervalMilliseconds ?? defaultCleanupIntervalMilliseconds;
    if (this.cleanupIntervalMilliseconds < 1) {
      throw new Error('Cleanup interval must be positive');
    }
    this.now = options.now ?? (() => new Date());
  }

  public run(): RetentionCleanupResult {
    const closedBefore = new Date(
      this.now().getTime() - this.retentionDays * millisecondsPerDay,
    );
    const result = this.repository.purgeClosedConversationContent(closedBefore);
    const details = { closedBefore, ...result };

    if (result.skippedRequests > 0) {
      this.logger.warn(
        details,
        'Retention kept expired requests with unfinished deliveries',
      );
    } else {
      this.logger.info(details, 'Retention cleanup completed');
    }

    return result;
  }

  public start(): void {
    if (this.interval) {
      return;
    }

    this.run();
    this.interval = setInterval(() => {
      try {
        this.run();
      } catch (error: unknown) {
        this.logger.error(error, 'Scheduled retention cleanup failed');
      }
    }, this.cleanupIntervalMilliseconds);
    this.interval.unref();
  }

  public stop(): void {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = undefined;
  }
}
