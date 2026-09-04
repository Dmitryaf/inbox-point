export async function request<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined
      ? {}
      : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
    ...(signal ? { signal } : {}),
  });
  const value = (await response.json()) as T & { message?: unknown };
  if (!response.ok) {
    throw new Error(
      typeof value.message === 'string'
        ? value.message
        : 'Не удалось выполнить действие.',
    );
  }
  return value;
}
