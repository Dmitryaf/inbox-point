import { z } from 'zod';

export const organizationNameSchema = z
  .string()
  .trim()
  .max(120)
  .regex(/^[^\r\n]*$/u);

export function normalizeOrganizationName(
  submitted: string | undefined,
  current: string | undefined,
): { organizationName?: string } {
  const name = (submitted ?? current)?.trim();
  return name ? { organizationName: name } : {};
}
