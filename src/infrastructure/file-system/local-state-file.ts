import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ZodType } from 'zod';

interface LocalJsonFileErrors {
  invalid: string;
  read: string;
}

export async function readOptionalJsonFile<T>(
  path: string,
  schema: ZodType<T>,
  errors: LocalJsonFileErrors,
): Promise<T | undefined> {
  let contents: string | undefined;
  try {
    contents = await readOptionalTextFile(path);
  } catch (cause: unknown) {
    throw new Error(errors.read, { cause });
  }
  if (contents === undefined) {
    return undefined;
  }

  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error(errors.invalid);
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(errors.invalid);
  }
  return result.data;
}

export async function readOptionalTextFile(
  path: string,
): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error: unknown) {
    if (isFileSystemError(error) && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

export function writePrivateJsonFile(
  path: string,
  value: unknown,
): Promise<void> {
  return writePrivateTextFile(path, JSON.stringify(value, undefined, 2) + '\n');
}

export async function removeOptionalFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error: unknown) {
    if (isFileSystemError(error) && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

export async function writePrivateTextFile(
  path: string,
  contents: string,
): Promise<void> {
  const directory = dirname(path);
  const temporaryPath = path + '.' + process.pid + '.tmp';
  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, contents, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

export function isFileSystemError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
