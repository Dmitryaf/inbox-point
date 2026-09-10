import { z } from 'zod';

export const defaultInstanceId = 'default';

export const instanceIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/)
  .default(defaultInstanceId);
