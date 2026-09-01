import { createHash } from 'node:crypto';

export function createVkRandomId(idempotencyKey: string): number {
  const value = createHash('sha256')
    .update(idempotencyKey)
    .digest()
    .readUInt32LE(0);
  return value & 0x7fffffff || 1;
}
