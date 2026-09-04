interface ErrorResponse {
  message?: string;
}

export async function request<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options,
  });
  const body = (await response.json().catch(() => ({}))) as ErrorResponse;
  if (!response.ok) {
    throw new HttpError(
      response.status,
      body.message ?? 'Не удалось выполнить запрос.',
    );
  }
  return body as T;
}

export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
