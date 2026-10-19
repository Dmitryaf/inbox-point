interface ErrorResponse {
  code?: unknown;
  error?: unknown;
  message?: unknown;
  statusCode?: unknown;
}

const fallbackErrorMessage = 'Не удалось выполнить запрос.';

export async function request<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers =
    options.body === undefined
      ? options.headers
      : { 'content-type': 'application/json', ...options.headers };
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    ...(headers ? { headers } : {}),
  });
  const body = (await response.json().catch(() => ({}))) as ErrorResponse;
  if (!response.ok) {
    throw new HttpError(response.status, userFacingErrorMessage(body));
  }
  return body as T;
}

function userFacingErrorMessage(body: ErrorResponse): string {
  const isFrameworkError =
    body.code !== undefined ||
    body.error !== undefined ||
    body.statusCode !== undefined;
  if (
    isFrameworkError ||
    typeof body.message !== 'string' ||
    !body.message.trim()
  ) {
    return fallbackErrorMessage;
  }
  return body.message;
}

export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
