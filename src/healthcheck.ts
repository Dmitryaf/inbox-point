import { HttpAvailabilityChecker } from '@/infrastructure/monitoring/http-availability-checker.js';

const checker = new HttpAvailabilityChecker(
  new URL(`http://127.0.0.1:${process.env.PORT ?? '3000'}/health`),
  5_000,
);

try {
  await checker.check();
} catch {
  process.exitCode = 1;
}
